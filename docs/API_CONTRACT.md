# API Contract — Olive V0

**Owner:** Backend subagent owns this file. All other subagents code against it.
**Base URL (local):** `http://localhost:8787`
**Base URL (tunneled):** `https://<ngrok-subdomain>.ngrok.app`
**Auth:** None for V0 (single-restaurant local demo). All write endpoints require header `X-Olive-Token: <env OLIVE_AGENT_TOKEN>` to prevent random internet traffic from creating orders once the ngrok URL is public.

---

## Conventions

- All requests/responses are JSON unless noted.
- All money is `*_cents` integers. Never floats.
- All timestamps are ISO-8601 UTC (`2026-05-22T19:30:00Z`).
- All IDs are integers (SQLite `INTEGER PRIMARY KEY`).
- Errors: `{ "error": { "code": "string", "message": "string" } }` with appropriate HTTP status.
- Idempotency on order mutations: include `Idempotency-Key` header; backend dedupes on `(conversation_id, idempotency_key)` within 10 minutes.

---

## Schemas

### `Item`
```ts
{
  id: number,
  name: string,
  description: string,
  price_cents: number,
  in_stock: boolean,
  allergens: string[],           // ['dairy','nuts','gluten','egg']
  spice_levels: string[],        // ['mild','medium','hot','extra_hot']  (empty if not applicable)
  prep_minutes: number,
  category: 'biryani'|'curry'|'appetizer'|'bread'|'dessert'|'drink'|'side',
  ingredients: string[],
  is_vegetarian: boolean,
  is_vegan: boolean,
  is_gluten_free: boolean,
}
```

### `MenuCompact` (returned to agent — small, token-efficient)
```ts
{
  items: Array<{
    id: number,
    name: string,
    price_cents: number,
    category: string,
    spice_levels: string[],
    is_vegetarian: boolean,
    short_desc: string,            // first sentence of description, max 80 chars
  }>,
  generated_at: string,            // ISO timestamp; agent uses to detect staleness
}
```

### `Order`
```ts
{
  id: number,
  status: 'open'|'submitted'|'completed'|'cancelled',
  customer_name: string|null,
  customer_phone: string|null,
  conversation_id: string|null,
  total_cents: number,
  lines: OrderLine[],
  created_at: string,
  submitted_at: string|null,
  completed_at: string|null,
  pickup_eta: string|null,
  order_number: string|null,       // human-readable, e.g. "P-1042", assigned on submit
}
```

### `OrderLine`
```ts
{
  id: number,
  item_id: number,
  item_name: string,               // snapshot
  quantity: number,
  unit_price_cents: number,        // snapshot
  modifiers: {
    spice_level?: 'mild'|'medium'|'hot'|'extra_hot',
    no_onions?: boolean,
    no_garlic?: boolean,
    extra?: string[],              // ['extra raita','extra naan']
    [k: string]: unknown,
  },
  notes: string|null,
}
```

---

## Public dashboard / menu endpoints

### `GET /menu`
Returns `MenuCompact` for **in-stock items only**. Used by agent at conversation start and on any "what do you have?" question.

**200**
```json
{ "items": [...], "generated_at": "2026-05-22T19:30:00Z" }
```

### `GET /items/:id`
Full `Item` (used by agent for ingredient / allergen / prep-time questions).

**200** `Item` — **404** if not found.

### `GET /menu/search?q=<text>`
Fuzzy search by name + description. Used when customer says something close-but-not-exact ("biriyani", "tikka thing").

**200**
```json
{
  "matches": [
    { "id": 1, "name": "Chicken Biryani", "score": 0.92, "in_stock": true },
    ...
  ]
}
```
Returns top 5 matches, score ≥ 0.4. Empty array if nothing matches.

---

## Stock management (dashboard → backend)

### `PATCH /items/:id/stock`
Body: `{ "in_stock": boolean }`
**200** updated `Item`. Triggers SSE event on `/orders/stream` with `event: menu_update`.

---

## Order taking (agent → backend)

> All `POST/PATCH/DELETE` order endpoints require `X-Olive-Token` header.

### `POST /orders`
Create empty order at start of conversation.

**Body:**
```json
{ "conversation_id": "el-conv-abc123", "customer_phone": "+14085551234" }
```

**201**
```json
{ "id": 7, "status": "open", "total_cents": 0, "order_number": null, "lines": [] }
```

### `POST /orders/:id/items`
Add a line to an order.

**Body:**
```json
{
  "item_id": 3,
  "quantity": 1,
  "modifiers": { "spice_level": "medium", "no_onions": true },
  "notes": null
}
```

**Errors:**
- `404 item_not_found`
- `409 item_out_of_stock` — agent should apologize and offer alternatives
- `400 invalid_modifier` — modifier not valid for this item (e.g. spice_level on a dessert)

**201**
```json
{
  "line_id": 21,
  "item_name": "Chicken Biryani",
  "unit_price_cents": 1699,
  "running_total_cents": 1699
}
```

### `PATCH /orders/:id/items/:line_id`
Update quantity / modifiers / notes.

**Body:** any subset of `{ quantity, modifiers, notes }`.
**200**
```json
{ "line_id": 21, "running_total_cents": 3398 }
```

### `DELETE /orders/:id/items/:line_id`
Remove a line. **200**
```json
{ "running_total_cents": 1699 }
```

### `GET /orders/:id`
Current full `Order`. Agent calls this before read-back to be safe.

### `POST /orders/:id/submit`
Finalize. Computes ETA from max(prep_minutes of lines). Sets `submitted_at`, `order_number`, `pickup_eta`. Emits SSE `event: order_submitted`.

**Body:**
```json
{ "customer_name": "Raj" }
```

**Errors:**
- `409 order_empty` — no lines
- `409 already_submitted`

**200**
```json
{
  "order_number": "P-1042",
  "total_cents": 4250,
  "eta_minutes": 22,
  "pickup_eta": "2026-05-22T19:52:00Z"
}
```

### `POST /orders/:id/cancel`
Customer changed their mind entirely. **200** `{ "status": "cancelled" }`.

---

## Dashboard endpoints

### `GET /orders?status=open|submitted|completed&limit=50`
List orders.
**200** `{ "orders": Order[] }` ordered by `created_at DESC`.

### `PATCH /orders/:id/complete`
Mark order kitchen-done. **200** updated `Order`. Emits SSE `event: order_completed`.

### `GET /orders/stream` (SSE)
Server-Sent Events stream. **Content-Type:** `text/event-stream`.

Events emitted:
- `order_created` — `Order`
- `order_updated` — `Order` (line add / remove / modify)
- `order_submitted` — `Order`
- `order_completed` — `Order`
- `menu_update` — `{ item_id, in_stock }`
- `ping` — `{}` every 25s for connection keepalive

Format:
```
event: order_submitted
data: { "id": 7, "order_number": "P-1042", ... }

```

---

## Call lifecycle hooks (telephony → backend)

### `POST /calls/started`
ElevenLabs webhook on call start. Used for analytics + rate limiting.
**Body:**
```json
{ "conversation_id": "el-conv-abc123", "from_number": "+14085551234", "started_at": "..." }
```
**200** `{ "allow": true }` — or `{ "allow": false, "reason": "rate_limit" }` if caller exceeded 5 calls/hour.

### `POST /calls/ended`
**Body:** `{ "conversation_id": "...", "duration_seconds": 312, "ended_reason": "customer_hangup" }`
**200** `{}` — used to close any still-open order from this conversation, log cost.

### `POST /calls/transcript_chunk`
Optional, for live transcript on dashboard. ElevenLabs sends partial transcripts.
**Body:** `{ "conversation_id": "...", "role": "agent"|"user", "text": "...", "timestamp": "..." }`
**200** `{}` — fans out as SSE `transcript_chunk` event.

---

## Agent tool mapping (ElevenLabs `tools.json` shape)

The agent has **exactly these 9 tools**:

| Tool name | Maps to | When called |
|---|---|---|
| `get_menu` | `GET /menu` | At conversation start, automatically |
| `get_item_details` | `GET /items/:id` | When customer asks ingredients/allergens/spice |
| `search_menu` | `GET /menu/search?q=...` | When customer says something approximate |
| `create_order` | `POST /orders` | First time a customer wants to order anything |
| `add_item` | `POST /orders/:id/items` | Each item the customer asks for |
| `update_item` | `PATCH /orders/:id/items/:line_id` | "Make that medium spice" / "change to two" |
| `remove_item` | `DELETE /orders/:id/items/:line_id` | "Actually skip the naan" |
| `get_order` | `GET /orders/:id` | Before read-back |
| `submit_order` | `POST /orders/:id/submit` | After customer confirms read-back |

The full JSON schema for each tool lives in `agent/tools.json` (built in Phase 1).

---

## Health / ops

### `GET /healthz`
**200** `{ "ok": true, "db": true, "version": "0.1.0" }`

### `GET /metrics` (optional, internal)
Prometheus-style metrics: call count, order count, error rate, p50/p95 endpoint latency.

---

## Out of scope for V0 (explicitly)

- Multi-restaurant / tenancy
- Auth beyond `X-Olive-Token`
- Payment
- Delivery
- SMS confirmation
- Real Toast POS integration (this clone IS the integration)
- User accounts
