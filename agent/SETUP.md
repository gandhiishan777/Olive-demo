# ElevenLabs Agent Setup — Olive V0

One-time wiring of the ElevenLabs Conversational AI agent. ~15 minutes.

## Prerequisites

- ElevenLabs account with access to **Conversational AI / Agents**
- The temp phone number **574-626-6385** assigned to your account (or your own number)
- Backend running locally + an ngrok tunnel pointing at port 8787
- Note your public tunnel URL (e.g. `https://olive.ngrok.app`) — you'll paste it into every tool

## Steps

### 1. Create the agent

ElevenLabs dashboard → Conversational AI → **Create agent**. Name it `Olive`.

### 2. Voice

Voice Library → search **"Indian English"**, filter conversational. Sample 3–4. Pick warm, mid-pace, female or male — your call. Set TTS model to **Flash v2.5** for lowest latency.

### 3. LLM

Easiest: built-in OpenAI **GPT-4o**. Switch to Claude Sonnet via custom LLM webhook later if needed.

### 4. System prompt

Paste the entire contents of [`agent/system_prompt.md`](system_prompt.md) into the **System Prompt** field. **Pre-rendered for Paradise Biryani.** To retarget, search-replace name / locations / greeting in the file first.

### 5. Tools (10)

For each tool in [`agent/tools.json`](tools.json):

1. Tools → **+ Add Tool → Server Tool (Webhook)**
2. Copy:
   - **Name** — verbatim
   - **Description** — verbatim (the LLM uses this to pick the tool)
   - **Method** — GET / POST / PATCH / DELETE
   - **URL** — replace `${BASE_URL}` with your ngrok URL
   - **Response timeout** — 10s
3. **Headers** — copy `Content-Type: application/json` where shown
4. **Path / query / body parameters** — copy as listed; mark each as LLM-provided **except**:
   - `create_order.conversation_id` → **Dynamic Variable** `system__conversation_id`
   - `create_order.customer_phone` (optional) → **Dynamic Variable** `system__caller_id`

Quick verify after import: agent should have 10 tools — `get_menu`, `get_item_details`, `search_menu`, `create_order`, `add_item`, `update_item`, `remove_item`, `get_order`, `submit_order`, `cancel_order`.

### 6. Auto-call get_menu on start

In the agent's tool settings, enable **auto-call** for `get_menu` on conversation start (loads the menu before the first turn). If your plan doesn't expose this toggle, the system prompt also instructs the model to call it manually on turn 1.

### 7. Turn-taking

- **Response delay:** ~0.7s (lets the caller hum/uh before the agent jumps in)
- **Interruption:** ON (so the caller can cut off a read-back to make changes)

### 8. Phone number

Phone numbers → assign 574-626-6385 (or your number) → this agent.

### 9. Smoke test

1. Backend up: `pnpm --filter @olive/backend dev`
2. Tunnel up: `make tunnel` (or `ngrok http 8787`)
3. Confirm tunnel URL matches what you pasted in the tools
4. Dashboard: `pnpm --filter @olive/dashboard dev` → http://localhost:5173
5. Dial **574-626-6385**
6. Say "what's on the menu?" → Olive lists items
7. Order chicken biryani medium spice + garlic naan → confirm → name "Test"
8. Check dashboard: order appears in **Live Orders** within ~2 seconds
9. Click **Mark Complete**

### 10. Migrating to a Twilio number

Buy a Twilio number, assign it to the same ElevenLabs agent via Phone Numbers → Add → Twilio. **Tools, system prompt, backend** all stay the same.

## Common gotchas

| Symptom | Fix |
|---|---|
| Tools 404 | Wrong base URL in tool config — re-check ngrok tunnel URL matches |
| Tools timeout | Backend not running, or ngrok session expired |
| Order appears in DB but not dashboard | SSE blocked by browser extension / dashboard tab not open |
| Agent says "${RESTAURANT_NAME}" literally | You pasted the file without rendering. Re-paste the actual system_prompt.md (it's already rendered) |
| Agent ignores 86'd items | Migration 003 wasn't run — every item still has empty `spice_levels`/`category`, agent gets useless menu data |
