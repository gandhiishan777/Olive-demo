// Mix a clean speech wav with a noise wav at a target signal-to-noise ratio in
// dB. Output is a 16kHz mono s16le .wav matching the clean input's length.
//
// Method:
//   1. Measure RMS of the speech with ffmpeg's volumedetect filter -> S_dB.
//   2. Measure RMS of the noise the same way                       -> N_dB.
//   3. Compute the gain we need to apply to noise so that
//        S_dB - (N_dB + gain) == target_snr_dB
//      i.e. gain = S_dB - N_dB - target_snr_dB.
//   4. ffmpeg -i speech -i noise -filter_complex
//        "[1:a]volume=<gain>dB,aloop=loop=-1:size=2e9,atrim=duration=<dur>[bg];
//         [0:a][bg]amix=inputs=2:duration=first:dropout_transition=0"
//      -ac 1 -ar 16000 -sample_fmt s16 out.wav
//
// We loop the noise (aloop) so a 5-second noise clip can cover a 12-second
// speech clip without obvious looping artefacts. Founders: use noise samples
// that are at least 8s long to keep this natural.

import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

async function ffmpegOutput(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return await new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', args);
    let stdout = '';
    let stderr = '';
    ff.stdout.on('data', (d) => (stdout += d.toString()));
    ff.stderr.on('data', (d) => (stderr += d.toString()));
    ff.on('error', reject);
    ff.on('exit', (code) => resolve({ stdout, stderr, code: code ?? -1 }));
  });
}

async function measureMeanDb(wavPath: string): Promise<number> {
  // -af volumedetect prints `mean_volume: -23.4 dB` on stderr.
  const { stderr } = await ffmpegOutput([
    '-hide_banner',
    '-i', wavPath,
    '-af', 'volumedetect',
    '-vn', '-sn', '-dn',
    '-f', 'null', '-',
  ]);
  const m = stderr.match(/mean_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/);
  if (!m) throw new Error(`mix.measureMeanDb: could not parse mean_volume from ffmpeg output for ${wavPath}`);
  return parseFloat(m[1]);
}

async function probeDurationSeconds(wavPath: string): Promise<number> {
  // ffprobe is part of ffmpeg distribution.
  const { stdout } = await new Promise<{ stdout: string; code: number }>((resolve, reject) => {
    const ff = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      wavPath,
    ]);
    let stdout = '';
    ff.stdout.on('data', (d) => (stdout += d.toString()));
    ff.on('error', reject);
    ff.on('exit', (code) => resolve({ stdout, code: code ?? -1 }));
  });
  const d = parseFloat(stdout.trim());
  if (!Number.isFinite(d)) throw new Error(`mix.probeDurationSeconds: ffprobe could not read duration of ${wavPath}`);
  return d;
}

export interface MixOptions {
  speechPath: string;
  noisePath: string;
  outPath: string;
  snrDb: number; // target signal-to-noise ratio in dB. higher = quieter noise.
}

export async function mix(opts: MixOptions): Promise<{ outPath: string; appliedNoiseGainDb: number }> {
  const { speechPath, noisePath, outPath, snrDb } = opts;
  await mkdir(dirname(outPath), { recursive: true });

  const [speechDb, noiseDb, speechDur] = await Promise.all([
    measureMeanDb(speechPath),
    measureMeanDb(noisePath),
    probeDurationSeconds(speechPath),
  ]);

  // We want: speech_db - (noise_db + gain) == snrDb  =>  gain = speech_db - noise_db - snrDb
  const gainDb = speechDb - noiseDb - snrDb;

  const filter =
    `[1:a]volume=${gainDb.toFixed(2)}dB,aloop=loop=-1:size=2e9,atrim=duration=${speechDur.toFixed(3)}[bg];` +
    `[0:a][bg]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[out]`;

  const args = [
    '-y',
    '-hide_banner',
    '-loglevel', 'error',
    '-i', speechPath,
    '-i', noisePath,
    '-filter_complex', filter,
    '-map', '[out]',
    '-ac', '1',
    '-ar', '16000',
    '-sample_fmt', 's16',
    outPath,
  ];
  const { code, stderr } = await ffmpegOutput(args);
  if (code !== 0) throw new Error(`mix: ffmpeg failed (${code})\n${stderr}`);

  return { outPath, appliedNoiseGainDb: gainDb };
}
