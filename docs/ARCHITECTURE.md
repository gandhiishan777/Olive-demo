# Architecture

```
                                            ┌───────────────────────────┐
                                            │   Paradise Biryani owner  │
                                            │      📱 calls phone        │
                                            └────────────┬──────────────┘
                                                         │ PSTN
                                                         ▼
                              ┌─────────────────────────────────────────────────┐
                              │  Stage 1: ElevenLabs temp # 574-626-6385        │
                              │  Stage 2: Twilio number (config swap)           │
                              └────────────────────────┬────────────────────────┘
                                                       │ inbound webhook
                                                       ▼
                              ┌─────────────────────────────────────────────────┐
                              │  ElevenLabs Conversational AI Agent             │
                              │  - System prompt: agent/system_prompt.md        │
                              │  - Tools (9): agent/tools.json                  │
                              │  - STT: ElevenLabs native (Deepgram on Plan B)  │
                              │  - LLM: Claude Sonnet 4.6 (custom-LLM webhook)  │
                              │  - TTS: ElevenLabs Flash v2.5 (Indian English)  │
                              └─────────────────────────┬───────────────────────┘
                                                        │ HTTPS tool calls
                                                        │ (X-Olive-Token header)
                                                        ▼
                                            ┌───────────────────────────┐
                                            │  ngrok tunnel             │
                                            │  https://<sub>.ngrok.app  │
                                            └────────────┬──────────────┘
                                                         │
                                                         ▼
       ┌─────────────────────────────────────────────────────────────────────────────┐
       │  Backend (Hono / Node 20)                                                   │
       │  - REST endpoints (docs/API_CONTRACT.md)                                    │
       │  - Postgres via postgres.js → Supabase (session pooler)                     │
       │  - SSE stream: /orders/stream (in-process EventEmitter — Supabase Realtime  │
       │    intentionally NOT used; backend is the only writer)                      │
       │  - Rate limit + idempotency + token auth                                    │
       └────────────┬────────────────────────────────────────────────────────────────┘
                    │                                                ▲
                    │ TCP (port 5432)                                │ Supabase Studio
                    ▼                                                │ (founder edits menu)
       ┌──────────────────────────────────────────────────┐         │
       │  Supabase Postgres                               │─────────┘
       │  - items, orders, order_lines, calls             │
       │  - order_number_seq (sequence)                   │
       └──────────────────────────────────────────────────┘
                    │
                    │ SSE (live updates)
                    ▼
       ┌──────────────────────────────────────────────────┐
       │  Dashboard (React + Vite + Tailwind)             │
       │  - Live Orders panel (incoming + Mark Done)      │
       │  - Menu Management panel (86 toggle)             │
       │  - Live Call panel (transcript scroll)           │
       └──────────────────────────────────────────────────┘
```

## Why this shape

- **Telephony-agnostic core.** The agent doesn't know if it's on ElevenLabs's number or Twilio's. Same `tools.json`, same `system_prompt`.
- **One source of truth for menu/orders.** Both the agent and the dashboard read/write through the same REST API. The 86 toggle on the dashboard affects what the agent sees within seconds (agent re-fetches `get_menu` on each new turn that mentions an item, or via a periodic `refresh_menu` ping — implementation detail in the agent module).
- **No POS dependency.** The backend IS the POS for V0. When we go to real Toast, only the backend changes.
- **SSE for live dashboard.** Simpler than WebSocket for one-way push; behind the same `http://localhost:8787`, no CORS proxy.

## Data flow: typical call

1. Customer dials 574-626-6385.
2. ElevenLabs answers, sends `POST /calls/started` to our backend.
3. Backend rate-limits, returns `{allow: true}`.
4. Agent greets, calls `get_menu` tool → backend returns compact menu.
5. Customer orders → agent calls `create_order`, then `add_item` per line.
6. Each tool call emits SSE → dashboard updates live.
7. Agent reads back order, customer confirms.
8. Agent calls `submit_order` → backend assigns order number + ETA, emits `order_submitted` SSE.
9. Dashboard shows the order in "Live Orders" panel.
10. Kitchen finishes → dashboard "Mark Complete" → `PATCH /orders/:id/complete` → SSE `order_completed`.
11. ElevenLabs sends `POST /calls/ended` → backend logs duration + cost.

## Failure modes

| Mode | What happens | Recovery |
|---|---|---|
| Backend down during call | Agent gets 5xx on tool call | Agent says "let me get a team member" (fallback prompt) |
| ngrok URL changes | Agent webhooks 404 | Pin a stable `NGROK_DOMAIN` (paid feature) or update agent config |
| Customer hangs up mid-order | Order stays `open`, no submit | `POST /calls/ended` triggers backend to close stale `open` orders |
| ElevenLabs STT mishears item | Customer disputes read-back | Agent confirms each item by name during read-back; corrections via `update_item` |
| 86'd item ordered between menu fetches | Backend returns `409 item_out_of_stock` | Agent apologizes + offers alternative |
