# Olive Voice Agent — Spec

Status: **wiring built** — backend tweak applied; `agent/tools.ts` + `agent/register.ts` written.
Remaining: ElevenLabs dashboard config (prompt, greeting, voice, telephony, transfer) + a live
`pnpm register` run to confirm SDK field shapes.
Scope: User Flows **1–4, 6, 7**. Reservations (flow 5) and SMS are **deferred**.
Platform: **ElevenLabs Agents** (STT + LLM + TTS + Twilio telephony configured in the EL dashboard).

The dashboard + HTTP API already exist (`/dashboard`). This agent only needs to (a) wire those
endpoints into EL as **server tools** via a re-runnable script, and (b) define the prompt +
conversation behavior that keeps the agent **fast and non-hallucinating**.

---

## 1. Architecture

```
Caller ──phone──> Twilio ──> ElevenLabs Agent ──HTTPS──> ngrok ──> Next.js dashboard ──> Supabase
                              (STT/LLM/TTS)               tunnel    (/api/* routes)
```

- The dashboard runs locally (`pnpm dev`, port 3000) exposed through **ngrok**.
  `dashboard/next.config.ts` already allowlists `*.ngrok-free.app` / `*.ngrok.io` / `*.ngrok.app`.
- EL calls our endpoints as **server tools** (webhooks). EL's LLM decides when to call them.
- State that must survive across tool calls in one conversation (the `order_id`, the ngrok
  `base_url`) is held in **EL conversation/dynamic variables** (see §4).

### What lives where

| Concern | Owner | Notes |
|---|---|---|
| Greeting, voice, model, telephony, transfer/end-call | **EL dashboard** | Not in this repo. |
| System prompt / behavior | EL dashboard | Authored from §6 of this doc. |
| Server tool definitions (name, desc, schema, URL) | **`/agent` script** | Pushed to EL via API; re-runnable. |
| Order/menu business logic, validation, totals, ETA | **dashboard `/api`** | Already built. |

---

## 2. Mapping flows → endpoints (grounded in actual code)

All endpoints verified against the real route files. Base = `{{base_url}}` (ngrok).

| Tool | HTTP | Path | Request body | Key response fields |
|---|---|---|---|---|
| `get_menu` | GET | `/api/menu` | — | `items[]` (incl. `id`, `name`, `price_cents`, `in_stock`, `category`, `spice_levels`, `allergens`, dietary flags) |
| *(auto)* `create_order` | POST | `/api/orders` | `{}` (name optional) | `order_id` |
| `add_item` | POST | `/api/orders/{{order_id}}/items` | `{ item_id, quantity, modifiers?, notes? }` | `line`, `line_total_cents`, `order_total_cents` |
| `update_item` | PATCH | `/api/orders/{{order_id}}/items/{lineId}` | one of `{ quantity?, modifiers?, notes? }` | `line`, `order_total_cents` |
| `remove_item` | DELETE | `/api/orders/{{order_id}}/items/{lineId}` | — | `deleted_line_id`, `order_total_cents` |
| `get_order` | GET | `/api/orders/{{order_id}}` | — | `order`, `lines[]`, `total_cents` |
| `submit_order` | POST | `/api/orders/{{order_id}}/submit` | **see §5 backend tweak** | `order` (incl. `order_number`), `lines[]`, `pickup_eta` |
| `transfer_call` | — | EL **system tool** | — | native; no API |
| `end_call` | — | EL **system tool** | — | native; no API |

### Critical facts from the code that drive the design

1. **`get_menu` returns ALL items incl. out-of-stock** (`api/menu/route.ts` has no `in_stock`
   filter). Each item carries `in_stock: true|false`. → The agent must **only offer in-stock
   items** but can **acknowledge** an 86'd one if the caller asks (flow 2). Knowing about 86'd
   items is required, not a bug.
2. **`add_item` takes a numeric `item_id`, never a name** (`schemas.ts` `AddItemBody`). The agent
   must map spoken item → `item_id` from the cached menu. **This is the #1 hallucination risk.**
   Mitigations in §6/§7.
3. **Modifiers never affect price.** Free-form blob (`{spice_level, no_onions}`). Total is always
   server-computed → the agent must never invent prices or totals.
4. **Every mutation returns `order_total_cents`.** So the running tally is free on every
   add/update/remove — the agent should read it back **without** a separate `get_order` call.
   `get_order` is reserved for the full read-back in flow 4.
5. **Order is locked after submit** (`409 ORDER_LOCKED` / `INVALID_TRANSITION`). No edits post-submit.
6. **`submit` rejects an empty order** (`409 EMPTY_ORDER`).
7. **`add_item` on an 86'd item → `409 ITEM_OUT_OF_STOCK`** even though the menu listed it. The
   agent should pre-filter on the cached `in_stock`, but must also handle this race gracefully.

---

## 3. Conversation lifecycle

```
1. CALL START
   - EL plays greeting ("Thanks for calling Olive, how can I help?")  [EL dashboard]
   - Tool: get_menu        → cache items for the whole call
   - Tool: create_order    → stash order_id in conversation var
   (both fire up front, ideally before/at greeting so there's zero wait when ordering starts)

2. MENU Q&A (flow 2)
   - Answer ONLY from cached menu. Offer in-stock items. If asked about an 86'd item,
     acknowledge it's unavailable today. No new tool calls.

3. TAKE ORDER (flow 3)
   - Each item: add_item (item_id from cache, quantity, modifiers/notes)
   - Changes: update_item (qty) / remove_item (line)
   - Keep running tally from order_total_cents in each response. No get_order per item.

4. READ BACK + CONFIRM (flow 4)
   - get_order once → read full list + total → "Is that everything / shall I place it?"
   - Capture customer name here (before submit) — see §5.

5. SUBMIT (flow 4→6)
   - On "yes": submit_order → speak order_number + pickup_eta.
   - Order appears on kitchen dashboard within its 3s poll.

6. WRAP UP (flow 6)
   - Final verbal confirm. end_call (system tool).

ESCALATE (flow 7) — at any point:
   - Caller asks for a human, OR agent cannot complete the request, OR repeated tool errors
     → transfer_call (system tool).
```

---

## 4. State & secrets (EL dynamic variables)

| Variable | Set when | Used by |
|---|---|---|
| `base_url` | Configured per session (ngrok URL) — secret/var | every tool URL |
| `order_id` | After `create_order` returns `order_id` | add/update/remove/get/submit URLs |
| `line_id` (transient) | Returned by `add_item` | only if a later `update_item`/`remove_item` targets it |

- Tool URLs are templated, e.g. `{{base_url}}/api/orders/{{order_id}}/items`.
- `order_id` capture: EL extracts `order_id` from the `create_order` response into a conversation
  variable (assistant-side variable extraction / response mapping).
- `line_id`: the agent generally edits the *most recent* line or re-derives ids from `get_order`.
  For the demo, prefer correcting via `get_order` to fetch line ids rather than tracking each one.

---

## 5. Required backend tweak (the ONLY code change to the dashboard)

Decision: **capture the customer name at the END, right before submit.**

Problem: the current `POST /api/orders/:id/submit` **ignores the request body entirely**
(`api/orders/[id]/submit/route.ts` reads no name) and `submit` does not set `customer_name`.
So a name asked at the end has nowhere to go without a change.

**Chosen approach — accept an optional name on submit:**
- Extend `submit` to read `{ customer_name?: string }` from the body and write it to the order
  during the same update that sets `status: "submitted"`.
- Add a tiny zod schema (`SubmitOrderBody = { customer_name?: string (1..120) }`), optional so
  existing no-body calls still work.
- `submit_order` tool then sends `{ customer_name }` captured in flow 4.

Why this over the alternatives:
- *Re-create order with name*: can't — order already has lines.
- *Separate PATCH /api/orders/:id for name*: that endpoint only accepts `{status:"completed"}`
  today; adding name there overloads the dashboard "Done" route. Submit is the cleaner home.

> This is the single dashboard change. Everything else is pure EL wiring. If we'd rather ship
> zero backend changes, fallback = ask name at the start and pass to `create_order` (no tweak),
> but that was not the chosen flow.

---

## 6. System prompt design (the anti-hallucination + speed core)

The prompt is authored in the EL dashboard. Principles:

### Grounding (no hallucination)
- "You may ONLY discuss and add items that appear in the menu you fetched at call start. Never
  invent items, prices, sizes, or availability."
- "To add an item you MUST use its exact `item_id` from the fetched menu. If you cannot find a
  matching item, ask the caller to clarify — do not guess an id."
- "Never state a price or order total from memory. Use the `order_total_cents` returned by the
  last tool call, converted to dollars."
- "If an item is `in_stock: false`, do not offer it. If the caller asks for it, say it's
  unavailable today and suggest an in-stock alternative from the same category."
- "Confirm the full order with `get_order` before submitting. Do not submit an empty order."

### Speed / naturalness (talk while tools run)
- "When you call a tool, speak a short, natural acknowledgement in the SAME turn so the caller
  never hears silence — e.g. 'Sure, adding two chicken biryani…', 'Let me pull that up…',
  'One sec while I place that.' Keep it under ~6 words."
- "Do not announce internal mechanics (no 'calling the API', no tool names, no ids out loud)."
- "Prefer one tool call per turn. Don't re-fetch the menu mid-call. Don't call `get_order` after
  every item — only for the final read-back."
- "Read the running total back only when the caller asks or at read-back, not after every item."

### Identity & scope
- Restaurant name, tone, hours → filled in EL dashboard.
- Out of scope (reservations) → "I can take your order or get you to someone for a reservation"
  (until flow 5 is built), then `transfer_call` if pushed.

### Escalation (flow 7)
- "If the caller asks for a person, or you hit repeated errors, or you can't fulfill the request,
  use the transfer tool. Briefly tell the caller you're connecting them."

---

## 7. Per-tool descriptions (what we'll write into each EL tool)

Tool *descriptions* are how EL's LLM decides when/how to call — they're a primary anti-hallucination
lever. Drafts:

- **get_menu** — "Fetch the current menu once at the start of the call. Returns every item with an
  `in_stock` flag, price in cents, category, spice levels, allergens, and dietary flags. Use the
  returned `id` as `item_id` when adding items. Items with `in_stock:false` must not be offered."
- **add_item** — "Add one menu item to the current order. `item_id` MUST come from the fetched
  menu. `quantity` is a positive integer. `modifiers` is an optional object of kitchen
  instructions (e.g. spice level, no onions) and does NOT change price. Returns the new line and
  the updated `order_total_cents`."
- **update_item** — "Change the quantity (or modifiers/notes) of a line already on the order.
  Needs the line's id. Use only on the open, not-yet-submitted order."
- **remove_item** — "Remove a line from the order by its line id. Use before the order is submitted."
- **get_order** — "Get the full current order (all lines + total) to read back to the caller before
  submitting. Use once near the end, not after every change."
- **submit_order** — "Finalize the order after the caller confirms. Optionally include
  `customer_name`. Returns the `order_number` and `pickup_eta` to tell the caller. The order can't
  be changed afterward."

### Error → spoken behavior

| API error | Agent says (natural) |
|---|---|
| `ITEM_OUT_OF_STOCK` (409) | "Looks like we just ran out of that — want me to swap it for X?" |
| `ITEM_NOT_FOUND` / no id match | Ask caller to clarify; never invent an id. |
| `EMPTY_ORDER` (409) on submit | "We haven't added anything yet — what can I get started for you?" |
| `ORDER_LOCKED` / `INVALID_TRANSITION` | Order already placed; offer to start a new one or transfer. |
| repeated `INTERNAL` (500) / timeout | Apologize once, then `transfer_call`. |

---

## 8. The wiring script (`/agent`) — to build after spec sign-off

Goal (your words): "a script for the tools and directly import them into ElevenLabs," re-runnable
when the ngrok URL changes.

- **Language:** TypeScript (matches the dashboard).
- **What it does:** uses the ElevenLabs API to **create/update the six server tools** (name,
  description from §7, method, URL templated with `{{base_url}}`/`{{order_id}}`, JSON param schema
  derived from the zod schemas in `dashboard/lib/schemas.ts`) and **attach them to the agent**.
- **Inputs (env):** `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `NGROK_BASE_URL`.
- **Idempotent:** look up existing tools by name; update if present, create if not. Re-running after
  an ngrok restart just updates URLs.
- **Out of scope for the script:** greeting, voice, model, telephony, system prompt, transfer/end
  (all EL dashboard).

Proposed `/agent` layout:
```
agent/
  AGENT_SPEC.md          <- this file
  tools.ts               <- tool definitions (name, desc, schema, url, method)
  register.ts            <- pushes tools.ts to EL + links to agent (re-runnable)
  .env.example           <- ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID, NGROK_BASE_URL
  package.json           <- deps (elevenlabs sdk) + "register" script
```

---

## 9. Open items / decisions

Resolved by research (ElevenLabs docs):
- [x] **Tool import is programmatic.** Server/webhook tools can be created via the API/SDK
      (`@elevenlabs/elevenlabs-js`, `conversationalAi.tools.create/update/list`) and linked to an
      agent via the agent's `prompt.tool_ids`. → built in `register.ts`.
- [x] **`order_id` extraction.** ElevenLabs **dynamic variables** + tool **response assignments**:
      a tool can assign a dot-notation path from its JSON response to a dynamic variable, then later
      tool URLs reference it as `{{order_id}}`. Path params use `{curly}`; secrets use `secret__`.
- [x] **Backend tweak (§5) — DONE.** `submit` now accepts optional `{customer_name}` and only
      overwrites when supplied (`api/orders/[id]/submit/route.ts`, `SubmitOrderBody` in `schemas.ts`).

Still needs the user (dashboard config, not code):
- [ ] **Greeting / restaurant identity** — wording, name, hours (ElevenLabs dashboard).
- [ ] **Transfer destination** — human phone number for `transfer_call`.
- [ ] **Verify SDK field names** at register time — run `pnpm register:dry` and confirm the
      payload shape against the installed `@elevenlabs/elevenlabs-js` version before the live call.

---

## 10. Build order (after sign-off)

1. Backend tweak: optional `customer_name` on `submit` (§5).
2. `agent/tools.ts` — six tool defs with §7 descriptions + schemas.
3. `agent/register.ts` — push to EL, link to agent (pending §9 verification).
4. EL dashboard: system prompt (§6), greeting, voice/model, Twilio number, transfer/end tools.
5. End-to-end test: call → menu Q → order → read-back → submit → verify card on kitchen view.
