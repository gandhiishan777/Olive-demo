# Noise samples

Audio is **not** checked into the repo — too large and the licenses vary.

This directory must contain four mono WAV files. The harness reads them by exact filename:

| File                  | What it should contain                            | Suggested length |
|-----------------------|---------------------------------------------------|------------------|
| `kitchen.wav`         | Restaurant kitchen: clattering, hood vent, oil    | >= 30 s          |
| `tv.wav`              | TV/news/sportscaster speech-like background       | >= 30 s          |
| `driving.wav`         | Inside a car at highway speed, no music           | >= 30 s          |
| `voices.wav`          | Restaurant babble / cafe crowd / cocktail party   | >= 30 s          |

Format requirements (the mixer normalizes to 16 kHz mono s16le on output, but
the input needs to be readable by ffmpeg):

- Container: WAV or FLAC, re-encode to WAV if you grabbed FLAC.
- Sample rate: anything (will be resampled).
- Channels: mono preferred. Stereo also fine; ffmpeg will downmix.
- Loudness: anything within ~-30 to -6 dBFS RMS. The mixer measures and
  re-gains to hit the target SNR, so absolute level doesn't matter.

## Where to get them (free, CC0 or CC-BY)

[freesound.org](https://freesound.org) is the easiest source. Search terms:

- kitchen: `commercial kitchen ambience`, `restaurant kitchen background`
- tv: `tv news background`, `sports announcer crowd`
- driving: `car interior highway`, `cabin road noise`
- voices: `restaurant babble`, `cafe ambience`, `cocktail party`

Filter for CC0 if you want zero attribution headaches.

[BBC Sound Effects](https://sound-effects.bbcrewind.co.uk/) and
[YouTube Audio Library](https://studio.youtube.com/) also have usable clips.

## Quick commands (placeholder — pick real freesound IDs)

```sh
# Place a curated CC0 ambience pack in this directory yourself, then:
#   ffmpeg -i <whatever-you-downloaded>.mp3 -ac 1 -ar 16000 kitchen.wav
# (etc. for tv.wav, driving.wav, voices.wav)
```

## What to do if a sample is missing

The harness will mark every run that needs that sample as `error: noise sample
missing: ...`. Other scenarios still run. Add the file and re-run; nothing else
needs to change.

## Why we don't ship audio

1. Repo bloat — these clips are typically 1-5 MB each.
2. Licensing — even CC-BY requires attribution we'd have to track.
3. Founders may want to use **their own** kitchen ambience recorded at Paradise
   Biryani — that's much higher signal than a generic freesound clip.
