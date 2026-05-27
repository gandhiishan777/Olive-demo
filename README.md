# Olive V0

AI voice agent for restaurant phone orders. Paradise Biryani pilot demo.

## Quick start

```bash
# 1. Deps
pnpm install

# 2. Env
cp .env.example .env
# Paste your Supabase session-pooler URL into SUPABASE_DB_URL

# 3. DB migrations (Supabase SQL editor)
# Paste backend/migrations/002_add_missing_columns.sql → Run
# Copy 003_populate_existing_rows.sql.template → .sql, edit, paste → Run
# (Optional, only if you previously had a 'calls' table) 004_drop_calls.sql

# 4. Start
make demo                                  # backend + dashboard + ngrok via tmux
# or 3 terminals:
#   pnpm backend
#   pnpm dashboard
#   make tunnel

# 5. Wire ElevenLabs (one time)
# Follow agent/SETUP.md

# 6. Dial 574-626-6385 and order chicken biryani
```

Dashboard: <http://localhost:5173> · Backend: <http://localhost:8787>

## Structure

```
backend/        Hono + postgres.js. REST + SSE. No auth.
dashboard/      React + Vite + Tailwind. Live Orders + Menu/86 panels.
agent/          ElevenLabs system prompt + 10 tools + setup guide.
backend/migrations/  SQL to run in Supabase.
docs/           API_CONTRACT.md, SETUP_DEMO.md.
```

## Key docs

- [docs/API_CONTRACT.md](docs/API_CONTRACT.md) — REST endpoints
- [docs/SETUP_DEMO.md](docs/SETUP_DEMO.md) — demo-day runbook
- [agent/SETUP.md](agent/SETUP.md) — ElevenLabs agent wiring
- [backend/migrations/README.md](backend/migrations/README.md) — DB migrations

## Telephony

| Stage | Number |
|---|---|
| Now | ElevenLabs temp **574-626-6385** |
| Later | Twilio number (config change in ElevenLabs — no code) |

## Troubleshooting

| Symptom | Fix |
|---|---|
| `SUPABASE_DB_URL required` | Set it in `.env` |
| 500 on `/menu` | Migration 002 not applied yet |
| Agent quotes prices/items that don't exist | Migration 003 not applied — items are missing `category`/`spice_levels`/`ingredients` |
| Order in DB but not dashboard | Browser blocking SSE — check console; or backend isn't running |
| Tools 404 from ElevenLabs | ngrok URL in tool config doesn't match your live tunnel |
