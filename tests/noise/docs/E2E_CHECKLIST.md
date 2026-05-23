# E2E noise test — live call checklist

This is the **manual** test that actually exercises ElevenLabs Conversational
AI's full pipeline (their STT + their VAD + their endpointer + their LLM
round-trip + our backend tools). The offline harness in this package cannot
reach ElevenLabs STT, so this is the only way to validate the >=85%
order-accuracy claim end-to-end before the founders demo to Paradise Biryani's
owner.

Run this checklist **once per session** before a demo, and **after any change
to the agent prompt, voice, or tool definitions.**

## Roles

You need two people, or one person willing to play both roles:

- **Caller**: holds the phone, reads the scenario script out loud.
- **Operator**: drives the laptop, plays the noise sample, watches the
  dashboard, records the resulting order in this checklist.

## One-time setup

1. Backend running, ngrok up, ElevenLabs agent pointed at the ngrok URL.
2. Dashboard open at `http://localhost:5173` (or wherever it lives).
3. ElevenLabs temp number 574-626-6385 ready to call.
4. Quiet room. Close doors. Phone earpiece off (don't use speakerphone on the
   caller side — that's a different test).
5. **Phone held normally** at the caller's cheek — about 2 cm from the mouth.
   If the founder demoing has a habit of holding the phone away from their
   face, train them to keep it close, OR document that as a separate
   condition.
6. Laptop speakers facing the caller, about **45 cm away**, **set to 60%
   system volume** as measured on a phone SPL meter app (target ~65 dB SPL
   at the phone microphone). Re-measure when the venue or the laptop
   changes.
7. Open the noise sample (`audio-samples/kitchen.wav` etc.) in a media
   player. Loop enabled. Volume at 60%. Don't start playback yet.

## Per-scenario procedure

For each row in the table below:

1. Operator: queue the noise sample. Hit play **before** Caller dials.
2. Caller: dial 574-626-6385. Wait for greeting.
3. Caller: read the **script** *exactly* as written. Resist the urge to
   improvise — that's what makes results comparable across runs.
4. Caller: answer agent confirmation questions yes/no only, do NOT
   re-state the order.
5. Caller: when agent reads back, confirm "yes" if and only if it
   matches the expected order. If not, say "no, I wanted X" and let
   the agent self-correct.
6. Operator: when call ends, open the dashboard, find the order, copy
   `lines[]` and `modifiers` into the result column.
7. Operator: judge PASS / FAIL using the criteria below.
8. Stop noise. 30s break. Move to next row.

## Scenarios (matches `src/scenarios.ts`)

### Quiet baseline (run first — sanity check)

| Scenario              | Script                                                                                                          | Expected lines + modifiers                                              |
|-----------------------|-----------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------|
| simple-order          | "Hi, can I get a chicken biryani, medium spice, and a garlic naan please?"                                       | Chicken Biryani x1 medium ; Garlic Naan x1                               |
| complex-modifiers     | "I'd like two lamb biryanis, one extra hot one mild, no onions on both, and three garlic naans on the side."    | Lamb Biryani x1 extra_hot no_onions ; Lamb Biryani x1 mild no_onions ; Garlic Naan x3 |
| mid-order-change      | "Let me get a paneer tikka masala, actually make that chicken tikka masala, and add a mango lassi please."     | Chicken Tikka Masala x1 ; Mango Lassi x1                                |
| allergen-question     | "Quick question — does the chicken biryani have any nuts or dairy? My kid is allergic. If it's safe I'll take one mild." | Agent answers allergens correctly; Chicken Biryani x1 mild              |
| 86d-item              | "Yeah I'll have the goat biryani extra hot, and a sweet lassi, that's it." (Operator toggles Goat Biryani out of stock before the call) | Agent says goat biryani is out; offers alternative; Sweet Lassi x1 (or alt) |

### Kitchen @ ~65 dB SPL noise (the main test)

Repeat the same five scenarios with `kitchen.wav` playing. PASS criteria are
**looser** here because read-back will recover most errors:

PASS = (a) every item in expected_items is present in the final order, AND
(b) spice level / quantity / "no onions" type modifiers are correct, AND
(c) agent did not invent items not in the script.

### TV @ ~65 dB SPL

Same five. Hardest because the interferer is itself speech.

### Driving @ ~70 dB SPL

Same five. Bump laptop volume +5 dB. Goal is to simulate a customer calling
from the car. Acceptable to drop one of the five scenarios for time.

### Voices (cocktail party) @ ~65 dB SPL

Same five. This and TV are the two we expect to fail first.

## Scoring sheet

For each cell, mark:

- **OK** — order matches expected exactly
- **REC** — order matches after agent's read-back self-correction
- **MISS:<item>** — final order is missing this item
- **EXTRA:<item>** — final order has an item the customer never asked for
- **MOD:<which>** — modifier wrong (e.g. spice level)

Total PASS count divided by total scenarios = **demo-readiness score**. Goal:
>= 85%.

## After the test

1. Operator: paste the scoring sheet into `tasks/noise-test-results-YYYYMMDD.md`.
2. If any row failed: file an issue with the failing condition + scenario +
   the dashboard's recorded `lines[]` + the agent transcript chunk JSON.
3. If overall < 85%: do NOT demo yet. Pivot the agent layer to LiveKit +
   Deepgram per `docs/STACK_DECISION.md` and re-run this checklist.

## Pitfalls we've already hit (read me)

- **Laptop speaker placement matters more than volume.** Behind the laptop
  screen = much quieter at the phone mic. Always speakers-facing-caller.
- **Phone case** can muffle the mic. Test with and without if you suspect.
- **Bluetooth headset** = a totally different acoustic chain. Don't mix
  results between handheld and Bluetooth runs; treat as two separate tests.
- **Restaurant accents.** Founders' demo will involve South-Indian English
  accents — the freesound CC0 clips are mostly US/UK. Plan to record a
  scenario take with a native Telugu speaker before the actual demo.
- **Audio-only noise is optimistic.** Real restaurants also have RF noise on
  the phone line. We can't simulate that offline; budget for some headroom.
