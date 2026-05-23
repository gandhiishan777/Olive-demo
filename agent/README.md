# `agent/` — Olive Voice Agent Config

This folder is the **entire** voice-agent layer of Olive V0. No server code lives here — just the system prompt, the 9 tool definitions, and the operational setup guide. Everything in this folder is consumed by the **ElevenLabs Conversational AI** dashboard at runtime.

## What's in here

| File | Purpose |
|---|---|
| `system_prompt.md` | The agent's full system prompt. **Pre-rendered for Paradise Biryani.** Search-and-replace the restaurant name, locations, and greeting line to retarget. Do NOT use `${VAR}` shell-style placeholders — ElevenLabs will ship them literally. Paste into the ElevenLabs agent **System Prompt** field. |
| `tools.json` | The 10 server tools the agent calls, mapped 1:1 to the REST endpoints in `docs/API_CONTRACT.md`. Imported into the ElevenLabs agent's **Tools** panel (or pasted tool-by-tool — see `SETUP.md`). |
| `SETUP.md` | Step-by-step operational guide: get the temp number, create the agent, pick voice/LLM, wire the tools, smoke test, migrate to Twilio. |
| `transcripts/` | Empty folder. Drop call transcript JSONs here as you iterate. Gitkept. |

## How the agent works at runtime

```
Caller dials 574-626-6385
        │
        ▼
ElevenLabs picks up
        │
        ├── auto-calls `get_menu` (preloads menu into context)
        ├── speaks the greeting verbatim
        │
        ▼
Conversation loop (per turn):
   1. STT (ElevenLabs native)
   2. LLM (OpenAI GPT-4o for V0, Claude Sonnet 4.6 as Phase 2)
   3. LLM decides: respond, or call one of 9 tools
   4. If tool: HTTPS → ngrok → backend → JSON response
   5. LLM consumes tool response, generates speech
   6. TTS (ElevenLabs Flash v2.5, Indian English voice)
        │
        ▼
On confirmation: `submit_order` → backend assigns order # + ETA
        │
        ▼
Sign-off + hangup → backend `POST /calls/ended` cleanup
```

The agent itself is stateless across turns — context comes from prior tool responses and the conversation history that ElevenLabs maintains. The **backend is the only system of record** for orders; the agent should never trust its own memory for read-back (hence rule #4 in the system prompt: always call `get_order` before reading back).

## The 9 tools at a glance

| Tool | HTTP | Endpoint | Notes |
|---|---|---|---|
| `get_menu` | GET | `/menu` | Auto-called at conversation start. Source of truth. |
| `get_item_details` | GET | `/items/{id}` | For ingredient / allergen / spice questions. |
| `search_menu` | GET | `/menu/search?q=...` | Fuzzy match for unclear pronunciations. |
| `create_order` | POST | `/orders` | Once per call, when ordering starts. Needs `X-Olive-Token`. |
| `add_item` | POST | `/orders/{id}/items` | Per-line. `X-Olive-Token`. |
| `update_item` | PATCH | `/orders/{id}/items/{line_id}` | Quantity / modifiers change. `X-Olive-Token`. |
| `remove_item` | DELETE | `/orders/{id}/items/{line_id}` | Drop a line. `X-Olive-Token`. |
| `get_order` | GET | `/orders/{id}` | Canonical state — call before every read-back. |
| `submit_order` | POST | `/orders/{id}/submit` | After caller confirms. `X-Olive-Token`. |

All write tools (POST / PATCH / DELETE) require the `X-Olive-Token` header. Configure once per tool in the dashboard.

## Iterating safely on the prompt

The system prompt is fragile — small wording changes can shift agent behavior a lot. To iterate without breaking the demo:

1. **Branch in git** before every prompt change (`git checkout -b prompt/<change>`).
2. **Change ONE thing at a time.** Tone, a rule, an example — not all three. Otherwise you can't attribute regressions.
3. **Run 5 test calls** through ElevenLabs's browser **Test Agent**. Cover: happy path, ambiguous item, out-of-stock, mid-order edit, escalation.
4. **Save transcripts to `agent/transcripts/`** with names like `2026-05-22-greeting-tweak-call-1.json`.
5. **Read the transcripts.** Look for: did the agent call the right tool at the right time? Did it invent anything? Did it read back the canonical order or its memory?
6. **Compare against `BUILD_SPEC.md` capabilities 1–10.** Any regression = revert that change.
7. **Merge to `main` only after** 5/5 calls passed on the new prompt + at least one full happy-path dial-in over the real phone number.

### A/B testing prompts with the founders

ElevenLabs supports **multiple agents** under the same account. To A/B:

1. Duplicate the Olive agent in the dashboard → name it `Olive — v2 (experiment)`.
2. Paste the new prompt into v2, leave v1 untouched.
3. Each founder uses ElevenLabs **Test Agent** on v2 for a day; another founder uses v1.
4. Collect feedback in `tasks/lessons.md`.
5. Promote the winner — copy v2's prompt over `agent/system_prompt.md`, commit, and update the production agent.

## Founders: retargeting Olive to other restaurants

The prompt is templated. To rebrand for a different restaurant, find-and-replace these placeholders in `system_prompt.md`:

- `${RESTAURANT_NAME}` → e.g. "Tony's Pizzeria"
- `${LOCATIONS_DESCRIPTION}` → e.g. "two locations in Brooklyn"
- `${GREETING_LINE}` → custom first line
- The "Restaurant facts" section — replace with concrete facts (cuisine, hours, payment policy)
- The "Tone guide" — adjust accent / register (e.g. "warm New York English" for a pizzeria)
- The example dialogues — replace dish names with the new restaurant's

`tools.json` and the backend stay the same — they're restaurant-agnostic.

## What this folder is NOT

- Not server code. The backend lives in `backend/`.
- Not the dashboard. The dashboard lives in `dashboard/`.
- Not the deploy config. `make demo` and orchestration live at the repo root.
