// Synthesize a clean reference speech .wav from text using OpenAI's tts-1.
// Cached by sha256(text + voice) -> tests/noise/audio-cache/clean/<hash>.wav
// so we don't pay every run.
//
// Why OpenAI tts-1 and not ElevenLabs? tts-1 is cheap ($15 / 1M chars), the
// founder almost certainly already has the key, and the customer-side voice
// quality is not what's being tested — the STT response is.
//
// Output format: mp3 from the API, transcoded to mono 16kHz s16le PCM .wav via
// ffmpeg. We do that transcode here so downstream mixing in mix.ts can assume
// the clean input is already in the right format.

import { createHash } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import OpenAI from 'openai';

export interface SynthOptions {
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  model?: 'tts-1' | 'tts-1-hd';
  cacheDir?: string;
}

const DEFAULT_CACHE = join(process.cwd(), 'audio-cache', 'clean');

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function hashKey(text: string, voice: string, model: string): string {
  return createHash('sha256').update(`${model}|${voice}|${text}`).digest('hex').slice(0, 16);
}

async function transcodeMp3ToWav(mp3Path: string, wavPath: string): Promise<void> {
  // 16kHz mono PCM s16le — what Deepgram & most STTs accept directly, and a
  // sane base for the noise-mix sox/ffmpeg step.
  await new Promise<void>((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-y',
      '-loglevel', 'error',
      '-i', mp3Path,
      '-ac', '1',
      '-ar', '16000',
      '-sample_fmt', 's16',
      wavPath,
    ]);
    ff.on('error', reject);
    ff.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
  });
}

export async function synthesize(text: string, opts: SynthOptions = {}): Promise<string> {
  const voice = opts.voice ?? 'alloy';
  const model = opts.model ?? 'tts-1';
  const cacheDir = opts.cacheDir ?? DEFAULT_CACHE;
  await mkdir(cacheDir, { recursive: true });

  const key = hashKey(text, voice, model);
  const wavPath = join(cacheDir, `${key}.wav`);
  if (await exists(wavPath)) return wavPath;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'synth: OPENAI_API_KEY not set. Set it in .env or skip TTS by placing a hand-recorded .wav at ' +
        wavPath,
    );
  }

  const client = new OpenAI({ apiKey });
  const resp = await client.audio.speech.create({
    model,
    voice,
    input: text,
    response_format: 'mp3',
  });
  const buf = Buffer.from(await resp.arrayBuffer());
  const mp3Path = join(cacheDir, `${key}.mp3`);
  await mkdir(dirname(mp3Path), { recursive: true });
  await writeFile(mp3Path, buf);
  await transcodeMp3ToWav(mp3Path, wavPath);
  return wavPath;
}

// Rough cost estimate: tts-1 = $15 / 1M characters as of 2026-05.
export function estimateSynthCostUsd(texts: string[]): number {
  const chars = texts.reduce((acc, t) => acc + t.length, 0);
  return (chars / 1_000_000) * 15;
}
