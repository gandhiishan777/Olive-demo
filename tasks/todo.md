# Olive V0 — status

V0 is simplified to a minimal working demo:

- ✅ Backend: Hono + Supabase Postgres, no auth, ~540 LoC
- ✅ Dashboard: React + Vite + Tailwind, 2 panels (orders + menu/86)
- ✅ Agent config: 10 tools, system prompt rendered for Paradise Biryani
- ✅ Migrations: 002 (schema), 003 (data — template, founder customizes), 004 (drop calls)
- ✅ One-command start: `make demo`

## To run the demo

1. Fill `.env` with `SUPABASE_DB_URL`
2. Apply migrations in Supabase SQL editor (002 → edited 003 → 004 if needed)
3. `make demo`
4. Wire the ElevenLabs agent per [`agent/SETUP.md`](../agent/SETUP.md)
5. Dial 574-626-6385

## Open items (post-demo polish)

- Real noise testing (audio samples, WER baseline against Deepgram)
- Twilio number swap (config-only in ElevenLabs dashboard once we have a number)
- Real menu data verification (run sanity SQL after migration 003)
