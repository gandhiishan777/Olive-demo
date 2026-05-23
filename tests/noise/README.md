# `@olive/noise-tests` — noise-resilience harness

**What this is.** A repeatable test that proves (or disproves) the Olive V0
spec's claim of **>=85% order accuracy under noise**. It synthesizes a known
customer utterance, mixes it with restaurant-style noise at a configurable
signal-to-noise ratio, runs it through STT, and scores the result on Word
Error Rate plus item-recall (did the menu item names actually survive?).

**What this is NOT.** A test of ElevenLabs Conversational AI's full pipeline.
ElevenLabs doesn't expose their STT as an ad-hoc API — you can only hit it
through a live phone call. So:

- The **offline** test in this package runs against **Deepgram Nova-3** (the
  documented Plan-B STT per `docs/STACK_DECISION.md`). That gives us a *lower
  bound* on what's achievable with our budget for noise robustness. If
  Deepgram clears 85% on our mixes, we have headroom to swap STT vendors
  without changing anything else.
- The **live** test (see `docs/E2E_CHECKLIST.md`) is the only way to actually
  measure ElevenLabs STT under noise, and it requires a human to play noise
  out of laptop speakers while a real call to 574-626-6385 is connected.

## 0. Prereqs

- Node 20+
- `pnpm` (this is a pnpm workspace package)
- `ffmpeg` and `ffprobe` in `PATH`
  - macOS: `brew install ffmpeg`
  - Ubuntu: `sudo apt-get install ffmpeg`
  - Windows: download from [ffmpeg.org](https://ffmpeg.org/download.html)
- API keys (only if you want to actually run, not just install):
  - `DEEPGRAM_API_KEY` (Plan-B STT — required for offline tests)
  - `OPENAI_API_KEY` (for TTS of the reference utterance — optional if you
    hand-record your own clean reference wavs and drop them in
    `audio-cache/clean/`)
  - `DEEPGRAM_MODEL` (optional, defaults to `nova-3`)

Put them in `.env` at the workspace root or export them in your shell.

## 1. Install

From the monorepo root:

```sh
pnpm install
```

That picks up this package because `pnpm-workspace.yaml` includes `tests/*`.

## 2. Drop in the noise samples

See [`audio-samples/README.md`](./audio-samples/README.md). TL;DR: download
four CC0 clips from freesound.org, transcode to WAV, name them `kitchen.wav`,
`tv.wav`, `driving.wav`, `voices.wav`. Without these files the harness will
still run the `quiet` baseline; mixed conditions will produce `error:`
rows but won't crash the run.

## 3. Run

```sh
pnpm --filter @olive/noise-tests run -- --help

# Full sweep across all scenarios + the default SNRs (10, 5, 0, -5 dB):
pnpm --filter @olive/noise-tests run -- --scenario=all --snr=10,5,0,-5

# Just the kitchen condition at 5 dB:
pnpm --filter @olive/noise-tests run -- --scenario=kitchen --snr=5

# Quiet baseline only (cheap; use this to record the floor):
pnpm --filter @olive/noise-tests run -- --scenario=quiet
# Or via the script alias:
pnpm --filter @olive/noise-tests record-baseline
```

The harness prints a per-row PASS/FAIL line and writes a JSON report to
`results/<timestamp>.json` (or `results/baseline.json` for `record-baseline`).

### Cost guard

Before running, the CLI prints a cost estimate (TTS chars + STT minutes). If
it exceeds **$0.50**, you must pass `--confirm-cost`. This is intentional —
a full sweep is cheap (single-digit cents) but the floor exists to stop a
runaway loop from spending real money.

## 4. Pass/fail thresholds

Set in `src/index.ts` (`WER_THRESHOLDS`). Defended values:

| Condition           | WER threshold | Rationale                                                       |
|---------------------|---------------|-----------------------------------------------------------------|
| `quiet`             | <= 5%         | Floor. If we fail here, our synth/STT pipeline is broken.        |
| `kitchen@5`         | <= 12%        | Kitchen ambience is broadband and stationary. Deepgram tolerant. |
| `tv@0`              | <= 15%        | TV background is *speech-like* — worst non-overlap case.         |
| `driving@-5`        | <= 20%        | Car interior — louder than the speaker, but stationary.          |
| `voices@5`          | <= 15%        | Cocktail-party / babble — interferer is speech-on-speech.        |

**Overall order-accuracy gate**: across all rows, >= 85% of `expected_items`
must appear (case-insensitive substring) in the STT hypothesis. This is the
proxy for the BUILD_SPEC's >= 85% order-accuracy demand. The harness exits
non-zero if either gate fails.

## 5. Interpreting WER

WER is *word*-level edit distance over the reference. Useful ranges:

- **< 5%**: indistinguishable from quiet, no policy concern
- **5-10%**: small fillers/articles wrong; menu items usually fine
- **10-15%**: agent will need to do confirmation read-back to recover
- **15-25%**: read-back will catch some errors but not all; expect rework
- **> 25%**: this STT vendor + condition is not viable; switch vendor

The thing we actually care about is item-recall, not raw WER. WER weighs every
word equally; the user does not. Hence the dual gate.

## 6. Adding scenarios

Edit `src/scenarios.ts`. Each scenario is a `(transcript, expected_items,
expected_modifiers)` triple. Use realistic phrasings — fillers ("uh"),
overlap ("actually make that..."), regional terms ("biriyani"). The harness
clears the synth cache by hash, so changing the transcript triggers a re-synth
automatically.

## 7. What to do when results regress

1. Check the JSON report. Group failures by condition first, then by scenario.
2. If `quiet` regressed: TTS voice changed, or STT vendor pushed a model
   update. Re-pin via env (`DEEPGRAM_MODEL=nova-3`).
3. If a single condition regressed and others didn't: the *noise sample*
   probably changed (someone re-downloaded it). Audio samples ought to be
   pinned by hash; we don't enforce that yet — see TODO.
4. If everything regressed in the same direction: STT vendor degraded. Try
   `--scenario=quiet` to isolate, then flip to the secondary vendor (TODO:
   add a second `stt.ts` adapter for OpenAI Whisper or AssemblyAI to
   cross-check).
5. If only one *scenario* regressed: the customer phrasing is borderline.
   Either tighten the scenario (more disambiguating words) or accept that the
   read-back step in the agent has to do the heavy lifting.

## 8. The live E2E test

See [`docs/E2E_CHECKLIST.md`](./docs/E2E_CHECKLIST.md). That test runs
**ElevenLabs STT** (which the offline harness can't reach) by playing the same
noise samples out of a laptop speaker into the phone while one of the founders
reads the scenario transcript aloud. The checklist is the discipline that
makes those runs comparable across days.

## 9. Files

```
tests/noise/
├── package.json
├── tsconfig.json
├── README.md            <- you are here
├── .gitignore
├── docs/
│   └── E2E_CHECKLIST.md
├── src/
│   ├── index.ts         <- CLI orchestrator
│   ├── scenarios.ts     <- test cases
│   └── lib/
│       ├── synth.ts     <- text -> clean wav via OpenAI tts-1
│       ├── mix.ts       <- clean + noise @ SNR -> mixed wav (ffmpeg)
│       ├── stt.ts       <- mixed wav -> transcript via Deepgram Nova-3
│       └── wer.ts       <- WER + item-recall
├── audio-samples/       <- you drop noise wavs here (not committed)
├── audio-cache/         <- synth + mixed artefacts (not committed)
└── results/             <- JSON reports (not committed)
```

## 10. Cost ballpark

For a full sweep (5 scenarios x 5 conditions = 25 STT calls):
- OpenAI TTS: ~$0.003 first run; $0.00 thereafter (cached by hash)
- Deepgram STT: ~$0.005 per run
- Total per full sweep: **~$0.13 first run, ~$0.13 each repeat** (TTS is the
  only thing cached; STT we re-bill every time because the mix differs).

A daily CI run for the demo week is ~$1.
