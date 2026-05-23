# Olive V0 — Voice agent demo

AI voice agent that takes phone orders for independent restaurants. Paradise Biryani pilot demo.

## Quick start (Ryan-proof)

```bash
# 1. Install deps
pnpm install

# 2. Fill in .env
cp .env.example .env
$EDITOR .env                # set SUPABASE_DB_URL, OLIVE_AGENT_TOKEN, ELEVENLABS_*, ANTHROPIC_API_KEY

# 3. Apply DB migrations (once, in Supabase SQL editor)
# Paste backend/migrations/002_add_missing_columns.sql → Run
# Copy + customize backend/migrations/003_populate_existing_rows.sql.template → Run

# 4. Start everything (backend + dashboard + ngrok tunnel)
make demo                   # requires tmux. Or run the 3 commands manually:
                            #   pnpm backend
                            #   pnpm dashboard
                            #   make tunnel

# 5. Wire ElevenLabs agent (one-time setup)
# Open agent/SETUP.md and follow the 5-step checklist.

# 6. Smoke-test the wiring:
OLIVE_AGENT_TOKEN=<your-token> pnpm --filter @olive/backend smoke

# 7. Dial 574-626-6385 and try ordering chicken biryani.
```

Dashboard at <http://localhost:5173>.
Backend at <http://localhost:8787>.

## What's inside

```
.
├── backend/        Hono + SQLite REST API (the "Toast clone")
├── dashboard/      React + Vite + Tailwind SPA
├── agent/          ElevenLabs Conversational AI config (system_prompt, tools.json)
├── seed/           Menu ingest pipeline (real menu lives in Supabase)
├── backend/migrations/  SQL migrations to run in Supabase SQL editor
├── tests/noise/    Noise-resilience test harness
├── docs/           Stack decision, API contract, architecture, setup guides
└── tasks/          Build plan + lessons
```

## Key docs

- [BUILD_SPEC.md](BUILD_SPEC.md) — original product brief
- [docs/STACK_DECISION.md](docs/STACK_DECISION.md) — why we chose this stack
- [docs/API_CONTRACT.md](docs/API_CONTRACT.md) — REST endpoints + agent tool mapping
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system diagram
- [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) — every env var explained
- [agent/SETUP.md](agent/SETUP.md) — ElevenLabs agent one-time wiring
- [tasks/todo.md](tasks/todo.md) — sprint plan + DoD

## Telephony strategy

| Stage | Number | Purpose |
|---|---|---|
| 1 | ElevenLabs temp **574-626-6385** | Founder testing today |
| 2 | Twilio number (TBD) | Demo with Paradise Biryani owner |

ElevenLabs runs their temp number on top of Twilio. Swapping to your own Twilio number is a config change in the ElevenLabs agent dashboard — no backend changes. See [docs/TELEPHONY.md](docs/TELEPHONY.md).

## Demo Day checklist

See [tasks/todo.md](tasks/todo.md) "Definition of Done" — every box must be green before you call the owner.

## Cost guardrails

Live in `.env`:
- 8-min call hard cap
- 500 tokens/turn
- 5 calls/hour/number
- $25/day kill switch

## Troubleshooting

- "Agent doesn't pick up" → check ngrok is running and `PUBLIC_BASE_URL` matches your tunnel URL.
- "Tools fail with 401" → `OLIVE_AGENT_TOKEN` in `.env` must match the header in `agent/tools.json`.
- "Dashboard shows nothing live" → check backend SSE stream: `curl http://localhost:8787/orders/stream`.
- "ElevenLabs STT mishears menu items in noise" → see [docs/STACK_DECISION.md](docs/STACK_DECISION.md) "Plan B: LiveKit + Deepgram fallback".
