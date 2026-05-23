# Backend — Olive V0

Hono + Supabase Postgres REST API. The "Toast clone" that the voice agent and dashboard both talk to.

## One-time setup (Supabase)

1. In Supabase dashboard → Project Settings → Database → **Connection string** → copy the **Session pooler** URL into `.env` as `SUPABASE_DB_URL`.
2. Open Supabase SQL editor, paste contents of [`migrations/002_add_missing_columns.sql`](migrations/002_add_missing_columns.sql), run. Adds the columns the API contract needs (spice_levels, prep_minutes, category, ingredients, dietary flags, customer_phone, completed_at, pickup_eta, order_number, modifiers, calls table, order-number sequence). Safe to re-run.
3. Copy `migrations/003_populate_existing_rows.sql.template` → `migrations/003_populate_existing_rows.sql`. Edit the `LIKE` patterns to match Paradise Biryani's real menu item names. Paste into SQL editor. Run. Verify with:
   ```sql
   SELECT name, category, prep_minutes, spice_levels FROM items WHERE category = 'side';
   ```
   Anything still in `side` needs an explicit `UPDATE` rule.

## Run

```bash
# .env at repo root must have SUPABASE_DB_URL + OLIVE_AGENT_TOKEN
pnpm --filter @olive/backend dev        # http://localhost:8787
# Or from this folder:
pnpm dev
```

Verify:

```bash
curl -s http://localhost:8787/healthz       # → {"ok":true,"db":true,"version":"0.1.0"}
curl -s http://localhost:8787/menu | jq .   # → list of in-stock items

# Full smoke test (lifecycle, auth, 86 reject, submit, complete):
OLIVE_AGENT_TOKEN=<your-token> pnpm smoke
```

## Architecture

```
migrations/
├── 001_baseline.sql                          (informational only)
├── 002_add_missing_columns.sql               run once in Supabase
├── 003_populate_existing_rows.sql.template   template; copy + customize
└── README.md
src/
├── index.ts                Hono server entrypoint (start() pings DB before serving)
├── db/
│   └── index.ts            postgres.js client; auto-detects session vs transaction pooler
├── lib/
│   ├── env.ts              zod-validated env loading
│   ├── logger.ts           pino with pretty dev output
│   ├── events.ts           in-memory EventEmitter consumed by SSE route
│   ├── fuzzy.ts            Dice-coefficient fuzzy match (no deps)
│   ├── idempotency.ts      in-memory 10-min cache keyed by Idempotency-Key
│   ├── rate-limit.ts       per-phone-number + daily-budget kill switch
│   └── order.ts            Order/Item hydration + submit logic + HttpError
├── middleware/
│   └── auth.ts             X-Olive-Token header, timing-safe compare
├── routes/
│   ├── health.ts           GET /healthz
│   ├── menu.ts             GET /menu, /items/:id, /menu/search; PATCH /items/:id/stock
│   ├── orders.ts           Full order lifecycle + dashboard list
│   ├── calls.ts            POST /calls/started, /calls/ended, /calls/transcript_chunk
│   └── stream.ts           GET /orders/stream (SSE)
└── scripts/
    ├── smoke.ts            curl-based E2E smoke test (`pnpm smoke`)
    └── dev-tools.ts        list-orders / clear-test-orders
```

## Endpoints

All endpoints implemented to match [docs/API_CONTRACT.md](../docs/API_CONTRACT.md). The full list:

| Method | Path                              | Auth | Notes |
|--------|-----------------------------------|------|-------|
| GET    | `/healthz`                        | —    | Liveness + DB ping |
| GET    | `/menu`                           | —    | Compact, in-stock only |
| GET    | `/items/:id`                      | —    | Full item w/ ingredients & allergens |
| GET    | `/menu/search?q=`                 | —    | Dice-coefficient fuzzy, top 5, score ≥ 0.4 |
| PATCH  | `/items/:id/stock`                | T    | The "86" toggle. Emits SSE `menu_update`. |
| POST   | `/orders`                         | T    | Idempotent on (conversation_id, Idempotency-Key) |
| GET    | `/orders/:id`                     | T    | Full order with lines |
| GET    | `/orders?status=&limit=`          | T    | Dashboard list |
| POST   | `/orders/:id/items`               | T    | Validates `spice_level` against item's allowed levels |
| PATCH  | `/orders/:id/items/:line_id`      | T    | Partial update; recomputes total |
| DELETE | `/orders/:id/items/:line_id`      | T    | Removes line |
| POST   | `/orders/:id/submit`              | T    | Generates P-#### order number + ETA |
| POST   | `/orders/:id/cancel`              | T    | Soft cancel |
| PATCH  | `/orders/:id/complete`            | T    | Kitchen done |
| POST   | `/calls/started`                  | T    | Returns `{allow:false}` when rate-limited or over daily budget |
| POST   | `/calls/ended`                    | T    | Logs duration + cost; auto-cancels any still-open order |
| POST   | `/calls/transcript_chunk`         | T    | Fans out as SSE `transcript_chunk` |
| GET    | `/orders/stream`                  | —    | SSE: all events above + `ping` every 25s |

`T` = requires header `X-Olive-Token: <env OLIVE_AGENT_TOKEN>`.

## SSE

`/orders/stream` is a single subscription channel. Every route handler that mutates state calls `bus.emitEvent(...)`; the SSE route forwards each event with the matching `event:` line.

Event types: `order_created`, `order_updated`, `order_submitted`, `order_completed`, `menu_update`, `call_started`, `call_ended`, `transcript_chunk`, `ping`.

## Auth

- `OLIVE_AGENT_TOKEN` must be ≥ 16 chars. Required in production.
- In dev, if unset, write endpoints are allowed (a warning is logged on every request).
- Comparison uses `crypto.timingSafeEqual` to avoid timing oracles.

## Idempotency

Pass `Idempotency-Key: <opaque>` on `POST /orders`, `POST /orders/:id/items`, `POST /orders/:id/submit`, `POST /calls/started`, `POST /calls/ended`. The first response is cached for 10 minutes keyed by `(scope, conversation_id, key)`; duplicate calls return the same body and status. Crucial when ElevenLabs retries a tool call after a network blip.

## Rate limiting & budget

- Per-phone-number limit: `RATE_LIMIT_CALLS_PER_HOUR` (default 5). Checked in `POST /calls/started`.
- Daily kill switch: `DAILY_CALL_BUDGET_USD` (default $25). Once the estimated spend exceeds this in a rolling 24-hour window, all new calls are rejected.

If exceeded, `POST /calls/started` returns `{allow:false, reason:"rate_limit"|"daily_budget"}`. Your ElevenLabs agent flow should hang up gracefully on this response (or play a polite "we're slammed, call back" message).

## Order-number generation

`counters` table seeded with `order_number=1041`. Each `POST /orders/:id/submit` atomically increments and formats as `${RESTAURANT_NAME[0]}-${n}` → `P-1042`, `P-1043`, etc.

## Tests

Unit tests:

```bash
pnpm test
# 5 passing (fuzzy search)
```

Integration tests against SQLite were dropped when we switched to Supabase Postgres. The end-to-end equivalent is `pnpm smoke` — runs against a real (running) backend + Supabase. Coverage:

- `/healthz` ping
- `/menu` returns items
- `/items` full list (in + out of stock)
- `/items/:id` detail
- `/menu/search` fuzzy
- Write without token → **401**
- Create order → add item → get order → submit (P-#### + ETA)
- Out-of-stock item → **409 item_out_of_stock**
- Re-submit submitted order → **409 already_submitted**
- Mark complete → **200**

The smoke test leaves a single test order in `completed` status. Clear with `pnpm dev-tools clear-test-orders` if you want a clean slate before the real demo.

## Adding an endpoint

1. Define the request/response shape in [docs/API_CONTRACT.md](../docs/API_CONTRACT.md) first.
2. Add a handler in the appropriate `routes/<file>.ts`. Use `zValidator` for input validation.
3. If it mutates state, emit `bus.emitEvent(...)` so the dashboard updates live.
4. If it's a write, apply `requireToken` middleware (already applied at the router level for `orders` + `calls`).
5. Add a test in `src/__tests__/`.

## Gotchas

- Money is **always integer cents**. Never float. Postgres has no money type we use; `price_cents` is `int4`.
- `order_lines.item_name` and `unit_price_cents` are **snapshots** — items can be renamed or repriced after the line is added; the line keeps its original copy.
- Total is recomputed via a single `UPDATE … SET total_cents = (SELECT SUM …)` query, so concurrent line edits can't race.
- `postgres.js` is **fully async**. Every DB call is `await sql\`…\``. No prepared-statement objects.
- The SSE route uses `streamSSE` from Hono. The keepalive ping every 25s prevents reverse-proxies (ngrok) from killing the connection on idle.
- The order-number prefix is the first letter of `RESTAURANT_NAME` env var (default `P` for Paradise). The number comes from a Postgres sequence (`order_number_seq`), started at 1042.
- **`SUPABASE_DB_URL` is required** at startup (except in test mode). The backend exits 1 if it can't ping the DB.
