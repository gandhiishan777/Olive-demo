# Environment variables

Every variable in `.env.example`, what it does, and what happens if it's wrong.

## Server

| Var | Default | Required | What it does |
|---|---|---|---|
| `PORT` | `8787` | no | Backend HTTP port |
| `NODE_ENV` | `development` | no | `production` enables stricter logging + caches |
| `LOG_LEVEL` | `info` | no | `debug` / `info` / `warn` / `error` |

## Auth

| Var | Default | Required | What it does |
|---|---|---|---|
| `OLIVE_AGENT_TOKEN` | — | **YES** | Header `X-Olive-Token` required on write endpoints. Generate with `openssl rand -hex 32`. Must match the header configured in `agent/tools.json` in the ElevenLabs dashboard. Without it, anyone who finds the ngrok URL can place orders. |

## Database

| Var | Default | Required | What it does |
|---|---|---|---|
| `DATABASE_URL` | `file:./data/olive.db` | no | SQLite file path. For Postgres later, switch to `postgres://...`. |

## Restaurant identity

| Var | Default | Required | What it does |
|---|---|---|---|
| `RESTAURANT_NAME` | `Paradise Biryani` | yes | Injected into system prompt + order numbers |
| `RESTAURANT_TIMEZONE` | `America/Los_Angeles` | yes | ETA calculation timezone |
| `RESTAURANT_PICKUP_ONLY` | `true` | yes | Tells agent it cannot promise delivery |

## Cost & safety guardrails

| Var | Default | What it does |
|---|---|---|
| `MAX_CALL_SECONDS` | `480` | 8-minute hard cap. Backend instructs agent to wrap up at 7:00. |
| `MAX_TOKENS_PER_TURN` | `500` | LLM output cap per agent reply |
| `MAX_TOKENS_PER_CALL` | `20000` | Total LLM tokens per conversation |
| `RATE_LIMIT_CALLS_PER_HOUR` | `5` | Per phone number. Repeat callers get a polite "we're rate-limited" message via `POST /calls/started → allow:false`. |
| `DAILY_CALL_BUDGET_USD` | `25` | Kill switch — backend rejects new calls past this threshold |

## ElevenLabs

| Var | Required | What it does |
|---|---|---|
| `ELEVENLABS_API_KEY` | YES | Server-side API access (Voice Library, agent management) |
| `ELEVENLABS_AGENT_ID` | YES | Identifier of the agent configured in dashboard |
| `ELEVENLABS_VOICE_ID` | YES | Indian English voice from Voice Library |
| `ELEVENLABS_MODEL_ID` | YES (`eleven_flash_v2_5`) | TTS model. Flash v2.5 is the lowest-latency current option. |

## LLM

| Var | Required | What it does |
|---|---|---|
| `ANTHROPIC_API_KEY` | YES (primary) | Powers the custom-LLM webhook |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` | Tool-calling LLM |
| `OPENAI_API_KEY` | optional | Fallback if Claude webhook latency exceeds 200ms overhead |
| `OPENAI_MODEL` | `gpt-4o` | Fallback model |

## Deepgram (Plan B only)

| Var | Required | What it does |
|---|---|---|
| `DEEPGRAM_API_KEY` | only if switching off ElevenLabs STT | Streaming STT for the LiveKit + Deepgram fallback |
| `DEEPGRAM_MODEL` | `nova-3` | Best noise-handling streaming model in 2026 |

## Twilio (Phase 3)

| Var | Required | What it does |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | when migrating off temp # | Twilio account |
| `TWILIO_AUTH_TOKEN` | when migrating off temp # | Twilio auth |
| `TWILIO_PHONE_NUMBER` | when migrating off temp # | The number Paradise Biryani's owner calls |

## Tunneling

| Var | Required | What it does |
|---|---|---|
| `NGROK_DOMAIN` | recommended | Stable subdomain. Without it, the ngrok URL changes per restart and you have to re-paste it into the ElevenLabs agent every time. |
| `PUBLIC_BASE_URL` | YES | Full HTTPS URL of your ngrok tunnel. Backend uses this to construct webhook URLs and validates incoming requests claim to come from this host. |
