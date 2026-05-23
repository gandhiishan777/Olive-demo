// Deepgram STT client. We deliberately use the pre-recorded (file) endpoint
// not the streaming socket — for an offline harness, pre-recorded is simpler,
// deterministic, and uses the same Nova-3 model the streaming Plan-B agent
// would. If we later want to verify streaming-specific behaviour (endpointing,
// interim results), add a second function here.
//
// ElevenLabs STT is NOT exposed as an ad-hoc transcription API at the time of
// writing — it's only reachable inside a Conversational AI session. So this
// harness can't cleanly test it offline. We document that in README.md and
// route the offline test against Deepgram (the Plan-B STT). The live E2E test
// (docs/E2E_CHECKLIST.md) is what actually exercises ElevenLabs STT.

import { readFile } from 'node:fs/promises';
import { createClient } from '@deepgram/sdk';

export interface SttResult {
  transcript: string;
  confidence: number;
  durationSeconds: number | null;
  rawModel: string;
  detectedLanguage: string | null;
  apiLatencyMs: number;
}

export async function transcribeWithDeepgram(filePath: string): Promise<SttResult> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) throw new Error('stt: DEEPGRAM_API_KEY not set. See tests/noise/README.md.');
  const model = process.env.DEEPGRAM_MODEL ?? 'nova-3';

  const client = createClient(apiKey);
  const buf = await readFile(filePath);

  const started = Date.now();
  const { result, error } = await client.listen.prerecorded.transcribeFile(buf, {
    model,
    smart_format: true,
    punctuate: true,
    diarize: false,
    language: 'en-US',
  });
  const apiLatencyMs = Date.now() - started;
  if (error) throw new Error(`stt.deepgram: ${error.message ?? String(error)}`);

  const channel = result?.results?.channels?.[0];
  const alt = channel?.alternatives?.[0];
  const transcript = alt?.transcript ?? '';
  const confidence = alt?.confidence ?? 0;
  const detectedLanguage = (channel?.detected_language as string | undefined) ?? null;
  const durationSeconds = result?.metadata?.duration ?? null;

  return {
    transcript,
    confidence,
    durationSeconds,
    rawModel: model,
    detectedLanguage,
    apiLatencyMs,
  };
}

// Deepgram Nova-3 pre-recorded pricing as of 2026-05: ~$0.0043 / minute.
// Conservative estimate for budgeting.
export function estimateSttCostUsd(speechSecondsTotal: number): number {
  return (speechSecondsTotal / 60) * 0.0045;
}
