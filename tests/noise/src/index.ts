#!/usr/bin/env node
// Olive V0 noise-resilience harness — CLI entrypoint.
//
// Usage:
//   pnpm --filter @olive/noise-tests run -- \
//     --scenario=kitchen|tv|driving|voices|all \
//     --snr=10,5,0,-5 \
//     [--output=results/<file>.json] \
//     [--confirm-cost]
//
// Pipeline per (scenario × condition):
//   1. synth.ts:   text -> clean .wav (cached)
//   2. mix.ts:     clean + noise sample @ target SNR -> mixed .wav
//   3. stt.ts:     mixed .wav -> transcript via Deepgram Nova-3
//   4. wer.ts:     transcript vs reference -> WER + item recall
//   5. emit JSON report; print PASS/FAIL table.
//
// "Quiet" is a special condition: no mix step, the STT runs against the clean
// synth wav. This is the baseline. Anything above ~5% WER quiet is a synth/STT
// pipeline problem, not a noise problem.

import 'dotenv/config';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join, resolve as resolvePath } from 'node:path';
import { SCENARIOS, type Scenario } from './scenarios.js';
import { synthesize, estimateSynthCostUsd } from './lib/synth.js';
import { mix } from './lib/mix.js';
import { transcribeWithDeepgram, estimateSttCostUsd } from './lib/stt.js';
import { wer, itemRecall } from './lib/wer.js';

// ---- conditions -----------------------------------------------------------

interface Condition {
  name: string;                 // 'quiet' | 'kitchen@5' | 'tv@0' | ...
  noiseSample: string | null;   // path under audio-samples/, null = quiet
  snrDb: number | null;
  werThreshold: number;         // pass if WER <= this
}

const NOISE_FILES = {
  kitchen: 'audio-samples/kitchen.wav',
  tv: 'audio-samples/tv.wav',
  driving: 'audio-samples/driving.wav',
  voices: 'audio-samples/voices.wav',
} as const;

// Per-condition WER thresholds. These are the pass/fail bars we'll defend in
// the founders' call. Documented in README.md.
const WER_THRESHOLDS: Record<string, number> = {
  quiet: 0.05,
  'kitchen@5': 0.12,
  'tv@0': 0.15,
  'driving@-5': 0.20,
  'voices@5': 0.15,
};

function buildConditions(scenarioArg: string, snrArg: string): Condition[] {
  // scenarioArg: 'all' | 'kitchen' | 'tv' | 'driving' | 'voices' | 'quiet'
  // snrArg: 'quiet' | comma-separated dB values (e.g. '10,5,0,-5')
  const out: Condition[] = [];
  const scenarios = scenarioArg === 'all'
    ? ['quiet', 'kitchen', 'tv', 'driving', 'voices']
    : [scenarioArg];
  for (const s of scenarios) {
    if (s === 'quiet' || snrArg === 'quiet') {
      out.push({ name: 'quiet', noiseSample: null, snrDb: null, werThreshold: WER_THRESHOLDS.quiet });
      if (s === 'quiet') continue;
    }
    const noisePath = (NOISE_FILES as Record<string, string>)[s];
    if (!noisePath) {
      throw new Error(`Unknown scenario "${s}". Valid: kitchen, tv, driving, voices, all, quiet.`);
    }
    const snrs = snrArg === 'quiet'
      ? []
      : snrArg.split(',').map((x) => Number(x.trim())).filter((n) => Number.isFinite(n));
    for (const snr of snrs) {
      const name = `${s}@${snr}`;
      out.push({
        name,
        noiseSample: noisePath,
        snrDb: snr,
        werThreshold: WER_THRESHOLDS[name] ?? defaultThresholdForSnr(snr),
      });
    }
  }
  // de-dup by name (e.g. 'quiet' showing up multiple times in 'all')
  return Array.from(new Map(out.map((c) => [c.name, c])).values());
}

function defaultThresholdForSnr(snrDb: number): number {
  // Linear fall-back curve when no explicit threshold is set:
  //   +10 dB -> 0.08, 0 dB -> 0.15, -10 dB -> 0.25
  if (snrDb >= 10) return 0.08;
  if (snrDb >= 5)  return 0.12;
  if (snrDb >= 0)  return 0.15;
  if (snrDb >= -5) return 0.20;
  return 0.25;
}

// ---- args -----------------------------------------------------------------

interface Args {
  scenario: string;
  snr: string;
  output: string | null;
  confirmCost: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { scenario: 'all', snr: '10,5,0,-5', output: null, confirmCost: false, help: false };
  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') out.help = true;
    else if (raw === '--confirm-cost') out.confirmCost = true;
    else if (raw.startsWith('--scenario=')) out.scenario = raw.slice('--scenario='.length);
    else if (raw.startsWith('--snr=')) out.snr = raw.slice('--snr='.length);
    else if (raw.startsWith('--output=')) out.output = raw.slice('--output='.length);
  }
  return out;
}

function printHelp(): void {
  process.stdout.write(`olive noise-test harness

Usage:
  pnpm --filter @olive/noise-tests run -- [options]

Options:
  --scenario=<name>   kitchen | tv | driving | voices | quiet | all   (default: all)
  --snr=<list>        comma-separated SNR dB values, or 'quiet'        (default: 10,5,0,-5)
  --output=<path>     write JSON report here (default: results/<timestamp>.json)
  --confirm-cost      required if estimated spend exceeds $0.50
  --help              this message

Requires: ffmpeg in PATH; DEEPGRAM_API_KEY in env; OPENAI_API_KEY in env (or pre-cached clean wavs).
See tests/noise/README.md for the full setup.
`);
}

// ---- main -----------------------------------------------------------------

interface ResultRow {
  scenario: string;
  condition: string;
  snr_db: number | null;
  reference: string;
  hypothesis: string;
  wer: number;
  wer_threshold: number;
  wer_pass: boolean;
  expected_items: string[];
  matched_items: string[];
  missed_items: string[];
  item_recall: number;
  stt_confidence: number;
  stt_latency_ms: number;
  audio_path: string;
  error: string | null;
}

async function ensureNoiseSample(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); return; }

  const conditions = buildConditions(args.scenario, args.snr);
  const scenarios = SCENARIOS;
  const runs = scenarios.length * conditions.length;

  // Cost estimate.
  const totalSpeechSeconds = scenarios.reduce((acc, s) => acc + Math.max(3, s.transcript.length / 14), 0);
  const synthCost = estimateSynthCostUsd(scenarios.map((s) => s.transcript));
  const sttCost = estimateSttCostUsd(totalSpeechSeconds * conditions.length);
  const total = synthCost + sttCost;

  process.stderr.write(
    `\nPlanned runs: ${runs} (${scenarios.length} scenarios x ${conditions.length} conditions)\n` +
    `Estimated cost: synth $${synthCost.toFixed(4)} + STT $${sttCost.toFixed(4)} = $${total.toFixed(4)}\n` +
    `(Real cost depends on cache hits + DEEPGRAM/OpenAI pricing changes.)\n\n`,
  );
  if (total > 0.5 && !args.confirmCost) {
    process.stderr.write('Estimated cost > $0.50. Re-run with --confirm-cost to proceed.\n');
    process.exit(2);
  }

  const results: ResultRow[] = [];
  for (const scenario of scenarios) {
    let cleanWav: string;
    try {
      cleanWav = await synthesize(scenario.transcript);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      process.stderr.write(`[${scenario.name}] synth failed: ${msg}\n`);
      for (const c of conditions) {
        results.push(makeErrorRow(scenario, c, msg));
      }
      continue;
    }

    for (const cond of conditions) {
      const row = await runOne(scenario, cond, cleanWav);
      results.push(row);
      const verdict = row.error ? 'ERR ' : row.wer_pass ? 'PASS' : 'FAIL';
      process.stderr.write(
        `[${verdict}] ${scenario.name.padEnd(22)} ${cond.name.padEnd(14)} ` +
        `WER=${(row.wer * 100).toFixed(1)}% (<=${(row.wer_threshold * 100).toFixed(0)}%) ` +
        `items=${row.matched_items.length}/${row.expected_items.length}` +
        (row.error ? `  ERROR: ${row.error}` : '') +
        '\n',
      );
    }
  }

  // Summary
  const valid = results.filter((r) => !r.error);
  const passed = valid.filter((r) => r.wer_pass).length;
  const itemsExpected = valid.reduce((acc, r) => acc + r.expected_items.length, 0);
  const itemsMatched = valid.reduce((acc, r) => acc + r.matched_items.length, 0);
  const overallItemRecall = itemsExpected === 0 ? 1 : itemsMatched / itemsExpected;

  process.stderr.write(
    `\nSummary: ${passed}/${valid.length} WER-pass.\n` +
    `Overall order-item recall: ${(overallItemRecall * 100).toFixed(1)}% (target >= 85%).\n` +
    `Errors: ${results.length - valid.length}.\n`,
  );

  // Persist
  const outRel = args.output ?? `results/${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const outAbs = resolvePath(outRel);
  await mkdir(resolvePath(outRel, '..'), { recursive: true });
  await writeFile(outAbs, JSON.stringify({
    generated_at: new Date().toISOString(),
    args,
    summary: {
      total: results.length,
      valid: valid.length,
      wer_passed: passed,
      overall_item_recall: overallItemRecall,
      order_accuracy_target: 0.85,
      order_accuracy_pass: overallItemRecall >= 0.85,
    },
    results,
  }, null, 2));
  process.stderr.write(`\nWrote ${outAbs}\n`);

  // Exit code: non-zero if either gate fails so CI can react.
  const allPassed = valid.length === results.length && passed === valid.length && overallItemRecall >= 0.85;
  process.exit(allPassed ? 0 : 1);
}

async function runOne(scenario: Scenario, cond: Condition, cleanWav: string): Promise<ResultRow> {
  let audioPath = cleanWav;
  let error: string | null = null;
  try {
    if (cond.noiseSample && cond.snrDb !== null) {
      const exists = await ensureNoiseSample(cond.noiseSample);
      if (!exists) {
        throw new Error(
          `noise sample missing: ${cond.noiseSample}. See tests/noise/audio-samples/README.md to fetch.`,
        );
      }
      const mixedPath = join('audio-cache', 'mixed', `${scenario.name}__${cond.name}.wav`);
      await mix({ speechPath: cleanWav, noisePath: cond.noiseSample, outPath: mixedPath, snrDb: cond.snrDb });
      audioPath = mixedPath;
    }
    const stt = await transcribeWithDeepgram(audioPath);
    const w = wer(scenario.transcript, stt.transcript);
    const rec = itemRecall(scenario.expected_items, stt.transcript);
    return {
      scenario: scenario.name,
      condition: cond.name,
      snr_db: cond.snrDb,
      reference: scenario.transcript,
      hypothesis: stt.transcript,
      wer: w,
      wer_threshold: cond.werThreshold,
      wer_pass: w <= cond.werThreshold,
      expected_items: scenario.expected_items,
      matched_items: rec.matched,
      missed_items: rec.missed,
      item_recall: rec.recall,
      stt_confidence: stt.confidence,
      stt_latency_ms: stt.apiLatencyMs,
      audio_path: audioPath,
      error: null,
    };
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    return makeErrorRow(scenario, cond, error, audioPath);
  }
}

function makeErrorRow(scenario: Scenario, cond: Condition, error: string, audioPath = ''): ResultRow {
  return {
    scenario: scenario.name,
    condition: cond.name,
    snr_db: cond.snrDb,
    reference: scenario.transcript,
    hypothesis: '',
    wer: 1,
    wer_threshold: cond.werThreshold,
    wer_pass: false,
    expected_items: scenario.expected_items,
    matched_items: [],
    missed_items: scenario.expected_items,
    item_recall: 0,
    stt_confidence: 0,
    stt_latency_ms: 0,
    audio_path: audioPath,
    error,
  };
}

run().catch((e) => {
  process.stderr.write(`\nFATAL: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(2);
});
