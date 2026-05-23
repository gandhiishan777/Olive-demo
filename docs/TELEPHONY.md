# Telephony — Olive V0

**Owner:** Telephony / Phone-path operations
**Last updated:** 2026-05-22
**Status:** Stage 1 active (ElevenLabs temp #). Stage 2 (Twilio) pending purchase.

This is the master doc for "how a phone call actually reaches our backend." If you're debugging a missed call, a 4xx webhook, or planning the Twilio cutover — start here.

---

## 1. Two-stage strategy

We deliberately ship voice in two stages so the founders can dial-test today without waiting on Twilio.

| Stage | Number | Who runs the PSTN leg | When |
|---|---|---|---|
| **1 — Now** | `574-626-6385` | ElevenLabs (Twilio under the hood) | Dev + first owner demos |
| **2 — Pre-launch** | Twilio number (TBD) | Us, on Twilio account | Owner-facing production |

**Key invariant:** The ElevenLabs agent config, `system_prompt.md`, `tools.json`, and our backend do **not** change between Stage 1 and Stage 2. Only the inbound phone-number plumbing changes.

---

## 2. Stage 1 — ElevenLabs temp number `574-626-6385`

### How it works
1. PSTN call hits `574-626-6385`.
2. ElevenLabs answers (their Twilio account under the hood — we never see it).
3. ElevenLabs Conversational AI loads our agent (configured in their dashboard).
4. Agent's tool calls hit `https://<ngrok>/...` → our backend on `localhost:8787`.

### What it costs us
- Per-minute usage is billed against the ElevenLabs plan (bundled minutes). No separate Twilio bill.
- We do **not** pay PSTN origination separately — it's inside the ElevenLabs minute price.

### When it expires / limits
- The temp number is a **shared / promotional** ElevenLabs number. Treat it as **non-persistent**:
  - It may be reassigned by ElevenLabs at any time.
  - It is **not** something we publish to a real customer.
  - Use it strictly for: dev loop, internal smoke tests, founder-only owner demos.
- I do not know the exact expiry window — **verify in the ElevenLabs dashboard before each demo**.

### Limitations vs. Stage 2
- No control over caller-ID display name.
- Cannot configure SIP features, recording retention, or compliance flags.
- Cannot port.
- Cannot brand SMS replies if we add SMS later.

---

## 3. Stage 2 — Twilio number + ElevenLabs native integration

### Migration steps (config change, not refactor)
1. Buy a Twilio number from console: **Phone Numbers → Buy a number**.
2. In Twilio console → that number → **Voice & Fax** section.
3. Set **A CALL COMES IN** → Webhook → paste ElevenLabs inbound webhook URL.
   - ElevenLabs publishes the exact URL in their docs: https://elevenlabs.io/docs/conversational-ai/phone-numbers/twilio
   - As of writing the pattern is `https://api.elevenlabs.io/v1/convai/conversation/phone/<agent_id>` — **verify in current ElevenLabs docs**, the path may have changed.
4. Set HTTP method to `POST`.
5. Save.
6. Dial the Twilio number to confirm.

### What does NOT change
- `system_prompt.md` — unchanged.
- `agent/tools.json` — unchanged.
- Backend routes — unchanged.
- Dashboard — unchanged.
- ngrok tunnel — unchanged.
- Claude Sonnet custom-LLM webhook — unchanged.

### What changes
- The phone number we hand to the owner.
- A new line item: Twilio number rental (~$1.15/mo) + Twilio per-minute pass-through.
- Twilio call logs become a second source of truth (alongside ElevenLabs).

---

## 4. Why this beats running our own Twilio Media Streams / ConversationRelay

We considered three architectures. We picked the one with the **least surface area for V0**.

| Approach | Surface area | Time-to-call | Picked? |
|---|---|---|---|
| ElevenLabs Conversational AI native phone | One vendor handles STT+LLM+TTS+phone glue | Hours | **Yes** |
| Twilio ConversationRelay → our backend → ElevenLabs/Deepgram/OpenAI | We own the WebSocket session, partial transcripts, barge-in, TTS streaming | 1–2 weeks | No (yet) |
| Twilio Media Streams (raw audio) → LiveKit Agents → our pipeline | We own everything down to PCM frames | 2–4 weeks | No |

For V0, every layer we own is a layer that can break on demo day. ElevenLabs's native phone integration removes:
- WebSocket session management.
- Audio frame buffering.
- Barge-in detection.
- TTS streaming back over telephony.
- DTMF handling.

That's a lot of stuff we don't have to debug at 9am on the morning of the Paradise Biryani call.

---

## 5. When we'd switch to Twilio ConversationRelay

Switch only if **one of the following becomes a blocker**:

1. **Latency.** ElevenLabs's E2E latency is ~350–527ms (per their docs). If we measure >900ms median in real owner calls and it's traced to the ElevenLabs orchestration layer (not LLM, not network), ConversationRelay's <500ms median becomes worth the integration cost.
2. **Barge-in control.** If owners interrupt the agent in patterns ElevenLabs doesn't handle well and we can't tune it out via prompt or config.
3. **Multi-agent handoff.** If V1 needs warm transfer to a human or to another agent, ConversationRelay's session model is cleaner.
4. **Recording / compliance.** If we need granular control over what gets recorded, where it's stored, and per-state PII rules.
5. **Cost.** If ElevenLabs minute pricing becomes uncompetitive at scale (>5k min/mo).

None of these apply for V0. Revisit at V1 planning.

Reference: https://www.twilio.com/docs/voice/conversationrelay

---

## 6. Plan B — LiveKit + Deepgram if noise tests fail

If the noise test harness (Phase 2 of the build) shows WER >8% on Paradise Biryani's actual phone audio, we pivot the **voice agent layer only**. We keep the Twilio number we bought in Stage 2.

### What changes vs. what doesn't

```
                         BEFORE (ElevenLabs path)              AFTER (LiveKit path)
                         ────────────────────────              ─────────────────────
  PSTN ─────────────►   Twilio number                          Twilio number          ◄── SAME
                              │                                      │
                              ▼                                      ▼
                       ElevenLabs Convai             Twilio ConversationRelay
                       (STT + LLM + TTS)                            │
                              │                                      ▼
                              │                            LiveKit Agents room
                              │                                      │
                              │                          ┌───────────┼──────────┐
                              │                          ▼           ▼          ▼
                              │                      Deepgram   Claude     ElevenLabs
                              │                      Nova-3     Sonnet 4.6 Flash v2.5 TTS
                              │                       (STT)     (LLM)      (TTS only)
                              ▼                                      │
                       tool calls → ngrok ──────────────────────────┘
                              │                                      │
                              ▼                                      ▼
                          Backend                                 Backend            ◄── SAME
                          + Dashboard                             + Dashboard        ◄── SAME
```

**Unchanged on Plan B:**
- Twilio number we already bought.
- `system_prompt.md`.
- `tools.json` (tool schemas; LiveKit Agents binds to the same HTTP endpoints).
- Backend (Hono + SQLite).
- Dashboard.
- ngrok tunnel.
- Claude Sonnet 4.6 as the LLM.
- ElevenLabs Flash v2.5 as the TTS (used in TTS-only mode).

**Changes on Plan B:**
- Twilio webhook points at ConversationRelay (not ElevenLabs).
- A new LiveKit Agents service runs alongside the backend.
- STT swaps from ElevenLabs-native to Deepgram Nova-3.
- We own the WebSocket session.
- Roughly 1–2 days of engineering to wire up, per `STACK_DECISION.md`.

We trigger this pivot only on a measured noise/WER failure. Don't pre-build it.

---

## 7. Quick reference — vendor docs

- ElevenLabs Conversational AI: https://elevenlabs.io/docs/conversational-ai/overview
- ElevenLabs ↔ Twilio integration: https://elevenlabs.io/docs/conversational-ai/phone-numbers/twilio
- Twilio Voice: https://www.twilio.com/docs/voice
- Twilio ConversationRelay: https://www.twilio.com/docs/voice/conversationrelay

ElevenLabs and Twilio dashboards both change layout periodically. The URLs above are stable but the in-dashboard screenshots / button labels in this doc may drift. Verify before clicking.
