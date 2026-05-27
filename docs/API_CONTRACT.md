# API Contract — Olive V0

**Base URL (local):** `http://localhost:8787`
**Base URL (tunneled):** your ngrok URL
**Auth:** none. The backend trusts the tunnel.

All money is `*_cents` integers. All timestamps are ISO-8601 UTC.

---

## Schemas

```ts
Item {
  id, name, description, price_cents, in_stock,
  allergens: string[], spice_levels: string[],
  prep_minutes, category, ingredients: string[],
  is_vegetarian, is_vegan, is_gluten_free
}

OrderLine {
  id, item_id, item_name, quantity, unit_price_cents,
  modifiers: object, notes
}

Order {
  id, status: 'open'|'submitted'|'completed'|'cancelled',
  customer_name, customer_phone, conversation_id,
  total_cents, order_number,
  created_at, submitted_at, completed_at, pickup_eta,
  lines: OrderLine[]
}
```

---

## Endpoints

### Menu

| Method | Path | Purpose |
|---|---|---|
| GET | `/menu` | Compact, in-stock items only (agent) |
| GET | `/items` | Full list incl. out-of-stock (dashboard) |
| GET | `/items/:id` | Full item detail |
| GET | `/menu/search?q=` | Fuzzy match, top 5 |
| PATCH | `/items/:id/stock` | `{in_stock: bool}` — emits SSE `menu_update` |

### Orders

| Method | Path | Purpose |
|---|---|---|
| POST | `/orders` | `{conversation_id, customer_phone?}` — reuses open order for same conversation |
| GET | `/orders/:id` | Full order |
| GET | `/orders?status=&limit=` | List for dashboard |
| POST | `/orders/:id/items` | `{item_id, quantity?, modifiers?, notes?}` |
| PATCH | `/orders/:id/items/:line_id` | Partial update |
| DELETE | `/orders/:id/items/:line_id` | Remove line |
| POST | `/orders/:id/submit` | `{customer_name}` → `{order_number, total_cents, eta_minutes, pickup_eta}` |
| POST | `/orders/:id/cancel` | Soft cancel |
| PATCH | `/orders/:id/complete` | Kitchen done |

### Misc

| Method | Path | Purpose |
|---|---|---|
| GET | `/healthz` | Liveness |
| GET | `/orders/stream` | SSE: `order_created`, `order_updated`, `order_submitted`, `order_completed`, `menu_update`, `ping` (every 25s) |

---

## Agent tool mapping (10 tools in `agent/tools.json`)

| Tool | Endpoint |
|---|---|
| `get_menu` | GET /menu |
| `get_item_details` | GET /items/:id |
| `search_menu` | GET /menu/search?q= |
| `create_order` | POST /orders |
| `add_item` | POST /orders/:id/items |
| `update_item` | PATCH /orders/:id/items/:line_id |
| `remove_item` | DELETE /orders/:id/items/:line_id |
| `get_order` | GET /orders/:id |
| `submit_order` | POST /orders/:id/submit |
| `cancel_order` | POST /orders/:id/cancel |

---

## Error codes

| Code | When |
|---|---|
| `item_not_found` | GET /items/:id misses |
| `item_out_of_stock` | add_item to a 86'd item |
| `invalid_modifier` | modifier value not allowed for that item |
| `order_locked` | add/update/remove on non-open order |
| `already_submitted` | submit twice / submit a non-open order |
| `order_empty` | submit without lines |
| `cannot_cancel` | cancel a non-open order |
| `cannot_complete` | complete a non-submitted order |
