# Olive Agent — Setup Guide (ElevenLabs Conversational AI)

End-to-end wiring for the **Olive** phone agent on ElevenLabs Conversational AI. Assumes the backend (`backend/`) is built per `docs/API_CONTRACT.md` and the dashboard is up.

**Audience:** founders + the engineer running the demo.

---

## 0. Prereqs

- ElevenLabs account with **Conversational AI** enabled ([elevenlabs.io](https://elevenlabs.io)).
- The Olive backend running locally on `http://localhost:8787` (per `docs/API_CONTRACT.md`).
- `ngrok` installed and authenticated. Paid plan with a reserved domain is **strongly recommended** so the agent's tool URLs don't break on restart.
- A copy of `agent/system_prompt.md` and `agent/tools.json` from this repo.
- The backend's `OLIVE_AGENT_TOKEN` from its `.env` (any random ~32-char string the backend was started with).

---

## 1. Get the temp phone number — 574-626-6385

ElevenLabs gives you a **temp inbound number** while you're setting up. This is what the founders dial during V0.

**Where to find it:**

1. Log into [elevenlabs.io](https://elevenlabs.io).
2. Sidebar: **Conversational AI → Phone Numbers**.
3. You'll see your provisioned ElevenLabs-hosted number listed there. For this project it is **574-626-6385**. (ElevenLabs runs this on Twilio under the hood — you don't touch Twilio yet.)
4. If it's not there, click **+ New Phone Number → ElevenLabs-hosted (US)** and request one. They appear within a minute.

---

## 2. Expose the backend with ngrok

Use a **reserved static domain** so you don't have to re-paste URLs into ElevenLabs every restart.

```bash
# Reserve a free static domain at https://dashboard.ngrok.com/cloud-edge/domains, then:
ngrok http --domain=<your-reserved>.ngrok.app 8787
```

Smoke check:

```bash
curl https://<your-reserved>.ngrok.app/menu | jq
curl https://<your-reserved>.ngrok.app/healthz | jq
```

You should see the seeded menu items and `{"ok": true, ...}` respectively.

Keep this terminal open for the whole demo.

---

## 3. Create the Agent in ElevenLabs

1. **Conversational AI → Agents → Create agent**.
2. Name it `Olive — Paradise Biryani (V0)`.
3. Set the **First message** to the verbatim greeting:
   > `Thanks for calling Paradise Biryani! This is Olive — what can I get started for you?`
4. **System prompt:** copy-paste the entire contents of `agent/system_prompt.md`. The file is **pre-rendered for Paradise Biryani** — restaurant name, location list, and greeting line are inline strings, not `${VAR}` templates. ElevenLabs does not expand shell-style placeholders, so any leftover `${VAR}` would ship verbatim. To retarget to another restaurant, edit the file before pasting.
5. Save.

---

## 4. Choose an Indian English voice

1. In the agent settings, click **Voice → Browse Voice Library**.
2. **Filter** by language: **English (India)** or search "Indian English".
3. Filter by gender if you have a preference (Olive is gender-neutral by design — both work). Most teams prefer female for hospitality.
4. **Sample 3–5 voices** using the play button. Listen for:
   - Conversational, not narrator-y.
   - Crisp on consonants (matters when reading dish names with retroflex sounds like "biryani", "tikka").
   - Warm, not sing-songy.
5. **Recommended starting picks** (sample these first if available): "Kanika", "Niraj", "Monika". If none feel right, search "Indian English conversational".
6. Select one, save.
7. **TTS model:** set to **Flash v2.5** (lowest latency, ~75ms TTFB) under Voice → Model.

---

## 5. Choose the LLM

You have two options for V0:

| Option | Pros | Cons | V0 recommendation |
|---|---|---|---|
| **OpenAI GPT-4o** (built-in) | Zero setup, lowest E2E latency through ElevenLabs's first-party integration. | Slightly looser tool-use than Claude on edge cases. | ✅ **Use this for V0 demo.** |
| **Claude Sonnet 4.6** (via custom-LLM webhook) | Better tone, stricter tool-call discipline, less hallucination. | Adds ~150–250ms per turn to the round trip. Custom-LLM webhook setup adds half a day. | Switch to this in Phase 2 once latency is measured. |

**To use OpenAI GPT-4o (V0 default):**
1. Agent settings → **LLM → Provider: OpenAI**.
2. Model: **gpt-4o** (NOT mini — mini mangles dish names).
3. Temperature: `0.4` (warm but not creative).
4. Max output tokens: `500` (per cost guardrail in `docs/STACK_DECISION.md`).

**To switch to Claude Sonnet 4.6 later:**
- LLM → Provider: **Custom LLM**.
- Endpoint URL: your Anthropic-proxy server URL.
- Follow ElevenLabs's custom LLM doc: <https://elevenlabs.io/docs/conversational-ai/customization/llm/custom-llm>.

---

## 6. Set the dynamic variables

The tools need access to ElevenLabs's system variables.

1. Agent settings → **Dynamic Variables** (sometimes under "Advanced").
2. Confirm `system__conversation_id` is available. (It is, by default.)
3. Confirm `system__caller_id` is available for caller phone number passthrough. (Optional.)
4. No new variables to add manually.

---

## 7. Import the 9 tools

You can either bulk-import `agent/tools.json` (if the dashboard supports it on your plan) or add each tool manually. The manual path:

For each of the 9 tools in `agent/tools.json`:

1. Agent settings → **Tools → + Add Tool → Server Tool (Webhook)**.
2. Copy across:
   - **Name** → the tool's `name` (verbatim — the LLM references it by this).
   - **Description** → the tool's `description` (verbatim — this is what the LLM reads to decide when to call it).
   - **Method** → `method` (GET / POST / PATCH / DELETE).
   - **URL** → `url`, with `${BASE_URL}` replaced by your ngrok URL (e.g. `https://olive.ngrok.app/menu`).
   - **Response timeout** → `response_timeout_secs`.
3. **Headers:** for every write tool (`create_order`, `add_item`, `update_item`, `remove_item`, `submit_order`):
   - Add header `X-Olive-Token` with value = your backend's `OLIVE_AGENT_TOKEN` value (NOT the placeholder string).
   - Add `Content-Type: application/json` for POST/PATCH.
   - Add `Idempotency-Key` if the tool spec includes one — set to a templated value combining `${conversation_id}` and the line identifier (the dashboard supports template variables in headers).
4. **Path parameters:** add each entry under `path_parameters` with its `name`, `type`, `required`, and description. Mark as **LLM-provided** (the model fills it from prior tool responses).
5. **Query parameters:** add each entry under `query_parameters` with the same fields. Mark as **LLM-provided** unless otherwise specified.
6. **Body parameters:** add each entry under `body_parameters`.
   - For `conversation_id` on `create_order`: set the source to **Dynamic Variable** = `system__conversation_id`. **NOT LLM-provided.**
   - For `customer_phone` on `create_order` (optional): set source to **Dynamic Variable** = `system__caller_id`.
   - For everything else (`item_id`, `quantity`, `modifiers`, `customer_name`, etc.): leave as **LLM-provided**.
7. Save the tool.

### Critical: agent-level webhooks ALSO need `X-Olive-Token`

The 9 Server Tools above cover ordering. The ElevenLabs platform separately calls
**agent-level webhooks** for call lifecycle events: `conversation_initiation`,
`post_call`, and `transcript`. These hit `/calls/started`, `/calls/ended`, and
`/calls/transcript_chunk` on our backend, and **those endpoints also require
`X-Olive-Token`**. Without this configuration, rate limiting and auto-cancel-on-hangup
will silently 401.

In the ElevenLabs dashboard:
1. Agent settings → **Webhooks → Conversation Initiation Webhook** (or "Pre-call webhook").
   - URL: `${BASE_URL}/calls/started`
   - Method: POST
   - Headers: `X-Olive-Token: <your OLIVE_AGENT_TOKEN value>`
2. Agent settings → **Webhooks → Post-call Webhook**.
   - URL: `${BASE_URL}/calls/ended`
   - Method: POST
   - Headers: `X-Olive-Token: <your OLIVE_AGENT_TOKEN value>`
3. (Optional) **Transcript streaming webhook**, if your plan exposes it.
   - URL: `${BASE_URL}/calls/transcript_chunk`
   - Method: POST
   - Headers: `X-Olive-Token: <your OLIVE_AGENT_TOKEN value>`

If your plan doesn't expose pre-call webhooks: rate limiting can be enforced
inside the agent instead with a system-prompt rule + the `get_menu` tool count,
but auto-cancel-on-hangup will not run.

### Tool quick checklist

Repeat for all 9 tools. Quick checklist:

- [ ] `get_menu` (GET, no auth header needed)
- [ ] `get_item_details` (GET)
- [ ] `search_menu` (GET, with query param `q`)
- [ ] `create_order` (POST, **X-Olive-Token**, conversation_id from dynamic var)
- [ ] `add_item` (POST, **X-Olive-Token**, Idempotency-Key)
- [ ] `update_item` (PATCH, **X-Olive-Token**)
- [ ] `remove_item` (DELETE, **X-Olive-Token**)
- [ ] `get_order` (GET)
- [ ] `submit_order` (POST, **X-Olive-Token**, Idempotency-Key)

---

## 8. Configure auto-call-on-start

The agent should call `get_menu` automatically at conversation start so the menu is in context before the first turn.

1. Agent settings → **Tools** → click on `get_menu`.
2. Find **"Auto-call on conversation start"** (or labeled "Call before first turn" / "Preload"). Enable it.
3. Save.

If your plan doesn't expose this, the system prompt already instructs the model to call `get_menu` on its first turn — but auto-call is faster and more reliable.

---

## 9. Configure turn-taking / silence settings

For diners who hum, pause, or talk over the agent:

1. Agent settings → **Conversation → Turn-taking**.
2. **Response delay** (also called "VAD silence threshold" or "End-of-turn delay"): set to **~0.7 seconds**. This gives diners who say "uhh" a moment before the agent jumps in.
3. **Interruption enabled:** **ON**. Caller can talk over the agent and the agent will stop mid-sentence.
4. **Max user silence before re-prompt:** 5 seconds (matches the system prompt rule).
5. **Total call duration cap:** 8 minutes (per cost guardrail in `docs/STACK_DECISION.md`).

---

## 10. Smoke test in the browser

Before dialing the phone, use ElevenLabs's built-in **Test Agent** (browser mic):

1. Click **Test Agent** in the dashboard.
2. Verify:
   - [ ] Agent says the greeting verbatim.
   - [ ] Ask "what's on the menu?" → it lists 3–5 actual items from the seeded menu (call ngrok inspector at `http://127.0.0.1:4040` and verify `GET /menu` was hit).
   - [ ] Order one item → ngrok shows `POST /orders` then `POST /orders/N/items`.
   - [ ] Say "that's it" → ngrok shows `GET /orders/N` → agent reads back the right total.
   - [ ] Confirm with a name → ngrok shows `POST /orders/N/submit` → agent reads back a `P-NNNN` order number.
3. Check the dashboard — the order should appear in the live orders panel within 2 seconds (via SSE).

---

## 11. Dial the phone number

1. From any phone, call **574-626-6385**.
2. Olive should pick up within 1–2 rings and say the greeting verbatim.
3. Ask "what's on the menu?" — verify it lists items.
4. Place a small test order (e.g. one biryani, one naan).
5. Confirm read-back and submission.
6. Check the dashboard for the order.
7. Hang up — verify `POST /calls/ended` fires in ngrok inspector.

**If you can't hear the agent at all:** check that the number is assigned to *this* agent in **Phone Numbers → 574-626-6385 → Assigned Agent**.

---

## 12. Migration from temp number → Twilio number (Phase 3)

Once V0 is signed off, swap to a Twilio-owned number. **Same agent config — no code changes.**

1. Buy a Twilio number at <https://console.twilio.com/us1/develop/phone-numbers/manage/incoming>.
2. ElevenLabs dashboard → **Phone Numbers → + New → Import from Twilio**.
3. Paste Twilio Account SID + Auth Token.
4. Select the number, **assign it to the Olive agent**.
5. ElevenLabs automatically configures Twilio's inbound webhook to point at ElevenLabs's media stream endpoint. You don't touch Twilio's webhook config manually.
6. Dial the Twilio number — same Olive agent answers.

If you ever need to do it manually: point the Twilio number's **Voice Configuration → A Call Comes In → Webhook** at ElevenLabs's inbound endpoint shown in the agent settings (typically `https://api.elevenlabs.io/v1/convai/conversation/...`).

---

## 13. Common gotchas

| Symptom | Cause | Fix |
|---|---|---|
| Every tool call returns 401/403 | `X-Olive-Token` header missing or wrong value. | Re-check the header value matches backend's `.env` `OLIVE_AGENT_TOKEN`. Must be on all write tools. |
| Tool call returns CORS error | You set CORS-restricted origin on the backend. | Backend should `Access-Control-Allow-Origin: *` for the demo, OR explicitly allow the ElevenLabs egress IPs. For V0 the simplest fix is `*` since the token already gates writes. |
| Agent calls `add_item` but every call creates a NEW order | `conversation_id` not wired as dynamic variable on `create_order` — model is generating a new one each turn. | Set `conversation_id` source to **Dynamic Variable → system__conversation_id**, NOT LLM-provided. |
| ngrok URL stopped working after restart | Free ngrok rotates the subdomain. | Use a reserved domain (`ngrok http --domain=...`). Update all 9 tool URLs in the dashboard if you don't have a reserved domain. |
| Agent reads prices like "one thousand six hundred ninety-nine cents" | Model is reading `price_cents` literally. | The system prompt addresses this (Rule #6). If still happening, increase the LLM tier or add an explicit example in the prompt. |
| Agent invents dishes not on the menu | Model is hallucinating. | (a) Confirm `get_menu` auto-call is enabled. (b) Reduce LLM temperature to 0.3. (c) Add the offending dish name to the "never invent" examples in the prompt. |
| Long silence after caller talks | Response delay set too high. | Drop to 0.6s. |
| Agent talks over caller | Interruption disabled or threshold too high. | Enable interruption, drop barge-in threshold. |
| `409 item_out_of_stock` even though item is in stock | Stale `get_menu`. | Confirm dashboard's 86 toggle hits `PATCH /items/:id/stock` and SSE emits `menu_update`. Agent should re-fetch `get_menu` after long pauses (system prompt rule #7). |
| Order submits with empty lines | Agent called `submit_order` before any successful `add_item`. | Should be caught by backend (`409 order_empty`). Add explicit check in agent: don't submit until `get_order` shows ≥1 line. |

---

## 14. After the demo: iterate on the prompt

- All prompt changes happen in `agent/system_prompt.md` and re-pasted into the dashboard.
- Version your prompts via git (`git log agent/system_prompt.md`).
- Save call transcripts to `agent/transcripts/` (ElevenLabs lets you download per-call JSON transcripts from the dashboard) so you can review what worked / didn't.
- Suggested A/B loop: change ONE thing at a time (e.g. tone, one rule, one example), run 5 calls, judge.

That's the whole setup. Total time from zero: ~30 minutes for someone who's done it once.
