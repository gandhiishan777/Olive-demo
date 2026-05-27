# Backend

Hono + postgres.js + Supabase. No auth. The "Toast clone" the voice agent and dashboard both talk to.

## Setup

1. `cp ../.env.example .env` and fill `SUPABASE_DB_URL`
2. In Supabase SQL editor: run [`migrations/002_add_missing_columns.sql`](migrations/002_add_missing_columns.sql), then your edited [`migrations/003_populate_existing_rows.sql`](migrations/) (copy the `.template`, edit `LIKE` patterns to your real menu)
3. `pnpm dev` → http://localhost:8787

```bash
curl -s http://localhost:8787/healthz                # → {"ok":true}
curl -s http://localhost:8787/menu | jq .            # → in-stock items
curl -s http://localhost:8787/items | jq '.items | length'
```

## Layout

```
migrations/                 SQL to apply in Supabase SQL editor
src/
├── index.ts                Hono entry; pings DB then serves
├── db/index.ts             postgres.js client + nextOrderNumber()
├── lib/
│   ├── env.ts              zod-validated env
│   ├── logger.ts           pino
│   ├── order.ts            getOrder / recomputeTotal / submitOrder (txn)
│   ├── fuzzy.ts            Dice-coefficient menu search
│   └── events.ts           in-process SSE bus
├── routes/
│   ├── health.ts           GET /healthz
│   ├── menu.ts             /menu /items /items/:id /menu/search /items/:id/stock
│   ├── orders.ts           full order lifecycle
│   └── stream.ts           SSE /orders/stream
└── scripts/dev-tools.ts    list-orders / clear-orders
```

## Endpoints

See [`docs/API_CONTRACT.md`](../docs/API_CONTRACT.md). All public, no auth.

## SSE

`/orders/stream` is a single channel emitting:
- `order_created` / `order_updated` / `order_submitted` / `order_completed`
- `menu_update`
- `ping` (25s keepalive)

Every route handler that mutates state calls `bus.emitEvent(...)`.

## Order submit

`submitOrder` runs inside a Postgres transaction with `SELECT ... FOR UPDATE` and a `WHERE status='open'` guard on the final UPDATE. Concurrent submits cannot both succeed; the loser gets `409 already_submitted`.

Order number comes from the `order_number_seq` sequence (atomic). Format: `${RESTAURANT_NAME[0].upper()}-${n}` → `P-1042`, `P-1043`, …

## Gotchas

- Money is integer cents. Always.
- `order_lines.item_name` and `unit_price_cents` are snapshots (items can be repriced later without changing past orders).
- If `/menu` returns 500 or items look empty, run migration 002 + 003.
