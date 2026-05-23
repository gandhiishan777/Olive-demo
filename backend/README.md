# Backend — Olive V0

Hono + SQLite REST API. The "Toast clone" that the voice agent and dashboard both talk to.

## Run

```bash
# From repo root, after `cp ../.env.example .env` and setting OLIVE_AGENT_TOKEN
pnpm --filter @olive/backend seed       # loads seed/placeholder_menu.json
pnpm --filter @olive/backend dev        # http://localhost:8787

# Or from this folder:
pnpm seed && pnpm dev
```

Verify:

```bash
curl -s http://localhost:8787/healthz       # → {"ok":true,"db":true,"version":"0.1.0"}
curl -s http://localhost:8787/menu | jq .   # → list of in-stock items
```

## Architecture

```
src/
├── index.ts                Hono server entrypoint
├── db/
│   ├── schema.sql          SQLite schema (items, orders, order_lines, calls, counters)
│   └── index.ts            better-sqlite3 init + order-number counter
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
    ├── seed.ts             pnpm seed
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

```bash
pnpm test
# 17 passing
```

Coverage:
- Menu fetch + in-stock filter
- Item detail
- Fuzzy search (typo: `biriyani` → Chicken Biryani)
- Auth (rejects without token, accepts with token)
- Full order lifecycle (create → add multiple items → submit)
- `409 item_out_of_stock` for 86'd items
- `400 invalid_modifier` for invalid spice_level
- `409 order_empty` for empty submit
- Idempotency on add_item (same line, not duplicated)
- 86 toggle (PATCH /items/:id/stock)

Tests use a fresh test DB at `data/olive.test.db` per run.

## Adding an endpoint

1. Define the request/response shape in [docs/API_CONTRACT.md](../docs/API_CONTRACT.md) first.
2. Add a handler in the appropriate `routes/<file>.ts`. Use `zValidator` for input validation.
3. If it mutates state, emit `bus.emitEvent(...)` so the dashboard updates live.
4. If it's a write, apply `requireToken` middleware (already applied at the router level for `orders` + `calls`).
5. Add a test in `src/__tests__/`.

## Gotchas

- Money is **always integer cents**. Never float. The DB has no money type.
- `order_lines.item_name` and `unit_price_cents` are **snapshots** — items can be renamed or repriced after the line is added; the line keeps its original copy.
- Total is computed on every mutation via `recomputeTotal(orderId)` and stored on the order row. We don't denormalize per-line totals.
- `better-sqlite3` is **synchronous**. That's fine for our scale (< 100 req/sec). Don't `await` DB calls — they're not promises.
- The SSE route uses `streamSSE` from Hono. The keepalive ping every 25s prevents reverse-proxies (ngrok) from killing the connection on idle.
