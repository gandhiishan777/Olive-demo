# Olive Voice Agent (ElevenLabs wiring)

Registers the dashboard's order API as **server tools** on an ElevenLabs agent.
See `AGENT_SPEC.md` for the full design. This package is ONLY the tool wiring —
greeting, voice, model, telephony, system prompt, and the native `transfer_call`
/ `end_call` system tools are configured in the ElevenLabs dashboard.

## Files

- `tools.ts` — the 6 server-tool definitions (name, description, method, path, params).
- `register.ts` — pushes the tools to ElevenLabs and links them to the agent. Re-runnable.
- `.env.example` — required env vars.

## Setup

```bash
cd agent
cp .env.example .env        # fill in ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID, NGROK_BASE_URL
pnpm install
```

## Run the dashboard + tunnel first

```bash
# in /dashboard
pnpm dev                    # http://localhost:3000
ngrok http 3000             # copy the https URL into NGROK_BASE_URL
```

## Register tools

```bash
pnpm register               # creates/updates tools, links them to the agent
pnpm register:dry           # print the payloads only, no API calls (debugging)
```

Re-run `pnpm register` whenever the ngrok URL changes — it updates the tool URLs
in place.

## Dynamic variables used

- `{{base_url}}` — the dashboard base URL (the register script bakes `NGROK_BASE_URL`
  into each tool URL at registration time).
- `{{order_id}}` — captured from `create_order`'s response and reused in later
  order tool URLs via response assignment.

## Note on SDK shape

`register.ts` targets `@elevenlabs/elevenlabs-js`. ElevenLabs evolves its API; if a
call errors on a field name, run `pnpm register:dry` to inspect the payloads and
adjust `toToolConfig()` / the SDK method names to match your installed version.
