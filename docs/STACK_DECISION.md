# Stack Decision — Olive V0

**Date:** 2026-05-22
**Verified against:** WebSearch results May 2026 + vendor docs
**Optimizing for:** Time-to-demo (14 days) × Noise robustness × Tool-call reliability

---

## TL;DR

| Layer | Choice | Why |
|---|---|---|
| Voice orchestration | **ElevenLabs Conversational AI** (Stage 1+2), with **LiveKit Agents** as documented fallback | Fastest time-to-call; temp # available today; same agent config swaps to Twilio in one click; falls back to LiveKit + Deepgram if noise testing fails |
| STT | **ElevenLabs native** (default) → swap to **Deepgram Nova-3** if WER >8% on noisy samples | Stays inside the ElevenLabs pipeline initially; Deepgram is the documented escape hatch |
| TTS | **ElevenLabs Flash v2.5** + Indian English voice from Voice Library | 75ms TTFB, 350–527ms E2E, current speed leader |
| LLM | **Claude Sonnet 4.6** via ElevenLabs "custom LLM" webhook (Anthropic API) | Strong tool-calling, available, restaurant-tone friendly |
| Telephony Stage 1 | ElevenLabs temp # **574-626-6385** (ElevenLabs runs this on Twilio under the hood) | Zero Twilio setup; founders can dial today |
| Telephony Stage 2 | Twilio number → ElevenLabs Conversational AI native integration | Config change, not refactor |
| Tunneling | **ngrok** (paid `--domain` recommended for stable webhooks) | Mature, well-known, 1 command |
| Noise suppression | Rely on ElevenLabs Conversational AI built-in + Deepgram Nova-3 noise robustness in fallback path | Krisp VIVA can be added in pipeline only on LiveKit path |
| Backend | **TypeScript + Hono + Supabase Postgres** (postgres.js direct connection) | Type-safe, hosted DB so the founders edit the real menu in Supabase Studio, in-process SSE bus stays |
| Dashboard | **React + Vite + Tailwind + SSE** | Single command spin-up, no Next.js overhead |
| Repo | pnpm workspaces | Lightweight monorepo |
| One-command start | `make demo` (or `pnpm demo`) | Spec requirement |

---

## What changed from the spec

The spec listed **LiveKit Agents OR Vapi** as orchestration. We chose **ElevenLabs Conversational AI** as the primary, demoting LiveKit to a documented Plan B. Reasons:

1. **The temp number 574-626-6385 is ElevenLabs-native.** Using their platform means we can demo end-to-end **within hours**, not days. LiveKit requires SIP trunk setup (2–4 days for a solo engineer new to voice).
2. **Your existing direction** (the system_prompt + tools.json format in the old `toast/elevenlabs/`) is ElevenLabs-native. We're aligned with where you were already heading.
3. **Twilio swap is a config change.** ElevenLabs Conversational AI has native Twilio inbound integration — point a Twilio number at their inbound webhook and the agent picks up. No backend changes.
4. **The noise-handling concession.** ElevenLabs Conversational AI uses their own STT (not Deepgram). This is the one real risk. Mitigation:
   - Build Phase 1 on ElevenLabs.
   - In Phase 2, run the noise test harness against real ElevenLabs calls.
   - If WER on menu items exceeds ~8%, pivot the **voice agent layer only** to LiveKit + Deepgram Nova-3. Backend + dashboard + system_prompt + tool definitions stay identical. Migration is ~1–2 days because the contract is shared.

This decision is reversible. The whole point of the API contract (next doc) is that the backend doesn't care who's on the other end of the phone.

---

## What we verified

- **Deepgram Nova-3** is still the streaming flagship in May 2026 (no Nova-4). 6.84% median WER streaming, sub-300ms latency. Deepgram **Flux** exists as a conversational variant. (cloudtalk, deepgram docs, transcriber.talkflowai)
- **ElevenLabs Flash v2.5** still the speed leader (~75ms TTFB; 350ms E2E US East, 527ms India). 32 languages incl. Hindi. v3 exists for quality but slower. (elevenlabs docs, waboom AI)
- **Twilio ConversationRelay** (GA in 2025) is now Twilio's recommended path for voice AI, <0.5s median latency. We don't need it because ElevenLabs handles Twilio inbound natively. Kept in our back pocket. (twilio.com)
- **LiveKit Agents** mature & production-ready, but **2–4 days time-to-first-call** for a backend engineer new to voice. Disqualified for Phase 1 by speed. (cloudtalk, modal.com)
- **Vapi** also strong but charges a ~$0.05/min platform fee on top of pass-through. ElevenLabs Conversational AI minutes are bundled into the ElevenLabs plan you already have. (cloudtalk, f22labs)

---

## Update 2026-05-22: switched SQLite → Supabase Postgres

We loaded the real Paradise Biryani menu into a Supabase Postgres instance earlier than expected, so the backend now talks to Supabase directly via `postgres.js` (session pooler URL). Reasons this is the right call:

- The founders can edit menu rows in **Supabase Studio** (their hosted SQL editor) without needing the backend running — useful for last-minute menu fixes before the demo.
- The dashboard's 86 toggle still works through our REST API, and our in-process SSE bus still pushes live events to the dashboard. **Realtime is intentionally not wired** because the backend is the only writer; SSE is lower-latency.
- API contract didn't change. Only the DB layer did. All 9 agent tools, all SSE event types, all error codes are unchanged.
- See [`backend/migrations/`](../backend/migrations/) for the migration files. `002` adds the columns the contract needs; `003` is a template to populate them on existing rows.

Tradeoff: backend now requires network connectivity to Supabase. If Ryan's WiFi flakes during the demo, the agent can't take orders — vs. SQLite where everything was local. Documented in [INCIDENT_RUNBOOK.md](INCIDENT_RUNBOOK.md).

## Cost guardrails

Per the spec, every voice call costs real money:
- Max call length: **8 minutes hard cap** (env-configurable)
- Max LLM tokens per turn: **500 output tokens**
- Max tokens per call: **20k total**
- Rate limit per phone number: **5 calls/hour**
- Daily call budget: **$25/day** (env-configurable kill switch)

---

## Risks & open questions

1. **ElevenLabs STT vs Deepgram in noise** — must test in Phase 2. Have LiveKit fallback ready.
2. **86 toggle latency** — need either polling from the agent (`refresh_menu` tool called periodically) or a webhook from backend → ElevenLabs. ElevenLabs supports `client_events` push to agent — verify in implementation.
3. **Real menu format** — founders will provide later. Parser must handle pasted text / photo / JSON. Built in Phase 2.
4. **Anthropic vs OpenAI for LLM** — Claude Sonnet 4.6 chosen because the harness primes for it, but if ElevenLabs "custom LLM" round-trip adds >200ms latency, fall back to OpenAI GPT-4o via their built-in integration.

---

## Sources

- [LiveKit vs Vapi 2026 (cloudtalk)](https://www.cloudtalk.io/livekit-vs-vapi-ai/)
- [LiveKit Alternatives 2026 (futureagi)](https://futureagi.com/blog/livekit-alternatives-2026/)
- [ElevenLabs Cheat Sheet 2026 (webfuse)](https://www.webfuse.com/elevenlabs-cheat-sheet)
- [Deepgram Nova-3 review 2026 (transcriber)](https://transcriber.talkflowai.com/blog/deepgram-nova-3-review-benchmarks-pricing)
- [Twilio ConversationRelay docs](https://www.twilio.com/docs/voice/conversationrelay)
- [ElevenLabs Conversational AI docs](https://elevenlabs.io/docs/conversational-ai/overview)
- [Deepgram models](https://developers.deepgram.com/docs/models-languages-overview)
- [ElevenLabs models](https://elevenlabs.io/docs/overview/models)
