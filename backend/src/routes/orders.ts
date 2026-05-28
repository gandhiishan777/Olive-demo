import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { sql } from "../db/index.js";
import {
  getOrder,
  recomputeTotal,
  submitOrder,
  HttpError,
  type Item,
  type Order,
} from "../lib/order.js";
import { bus } from "../lib/events.js";

export const ordersRouter = new Hono();

const ModifiersSchema = z
  .object({
    spice_level: z.enum(["mild", "medium", "hot", "extra_hot"]).optional(),
    no_onions: z.boolean().optional(),
    no_garlic: z.boolean().optional(),
    extra: z.array(z.string()).optional(),
  })
  .catchall(z.unknown())
  .default({});

ordersRouter.post(
  "/orders",
  zValidator("json", z.object({
    conversation_id: z.string().min(1),
    customer_phone: z.string().nullable().optional(),
  })),
  async (c) => {
    const { conversation_id, customer_phone } = c.req.valid("json");

    // Re-use existing OPEN order for the same conversation; otherwise create.
    const existingRows = await sql<Pick<Order, "id">[]>`
      SELECT id FROM orders
       WHERE conversation_id = ${conversation_id} AND status = 'open'
       ORDER BY created_at DESC LIMIT 1
    `;
    if (existingRows[0]) {
      const order = (await getOrder(existingRows[0].id))!;
      return c.json({ id: order.id, status: order.status, total_cents: order.total_cents, order_number: order.order_number, lines: order.lines }, 200);
    }

    const [created] = await sql<[{ id: number }]>`
      INSERT INTO orders (status, conversation_id, customer_phone, total_cents)
      VALUES ('open', ${conversation_id}, ${customer_phone ?? null}, 0)
      RETURNING id
    `;
    const id = created!.id;
    const order = (await getOrder(id))!;
    bus.emitEvent({ type: "order_created", data: order });
    return c.json({ id, status: "open", total_cents: 0, order_number: null, lines: [] }, 201);
  },
);

ordersRouter.get("/orders/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: { code: "bad_id", message: "invalid id" } }, 400);
  const order = await getOrder(id);
  if (!order) return c.json({ error: { code: "not_found", message: "order not found" } }, 404);
  return c.json(order);
});

ordersRouter.get(
  "/orders",
  zValidator("query", z.object({
    status: z.enum(["open", "submitted", "completed", "cancelled"]).optional(),
    limit: z.coerce.number().int().positive().max(200).optional(),
  })),
  async (c) => {
    const { status, limit = 50 } = c.req.valid("query");
    const rows = status
      ? await sql<Pick<Order, "id">[]>`SELECT id FROM orders WHERE status = ${status} ORDER BY created_at DESC LIMIT ${limit}`
      : await sql<Pick<Order, "id">[]>`SELECT id FROM orders ORDER BY created_at DESC LIMIT ${limit}`;
    const orders = await Promise.all(rows.map((r) => getOrder(r.id)));
    return c.json({ orders: orders.filter((o): o is Order => o !== undefined) });
  },
);

ordersRouter.post(
  "/orders/:id/items",
  zValidator("json", z.object({
    item_id: z.number().int().positive(),
    quantity: z.number().int().min(1).max(99).default(1),
    modifiers: ModifiersSchema.optional(),
    notes: z.string().max(500).nullable().optional(),
  })),
  async (c) => {
    const orderId = Number(c.req.param("id"));
    if (!Number.isFinite(orderId)) return c.json({ error: { code: "bad_id", message: "invalid id" } }, 400);
    const { item_id, quantity, modifiers, notes } = c.req.valid("json");

    const [item] = await sql<Item[]>`
      SELECT id, name, price_cents, in_stock, spice_levels
      FROM items WHERE id = ${item_id}
    `;
    if (!item) return c.json({ error: { code: "item_not_found", message: "item not found" } }, 404);
    if (!item.in_stock) return c.json({ error: { code: "item_out_of_stock", message: `${item.name} is currently unavailable` } }, 409);

    // Atomic: only INSERT if the order is still open.
    const inserted = await sql<Array<{ id: number }>>`
      INSERT INTO order_lines (order_id, item_id, item_name, quantity, unit_price_cents, modifiers, notes)
      SELECT ${orderId}, ${item.id}, ${item.name}, ${quantity}, ${item.price_cents}, ${sql.json((modifiers ?? {}) as never)}, ${notes ?? null}
       WHERE EXISTS (SELECT 1 FROM orders WHERE id = ${orderId} AND status = 'open')
      RETURNING id
    `;
    const line = inserted[0];
    if (!line) {
      const [existing] = await sql<Pick<Order, "status">[]>`SELECT status FROM orders WHERE id = ${orderId}`;
      if (!existing) return c.json({ error: { code: "not_found", message: "order not found" } }, 404);
      return c.json({ error: { code: "order_locked", message: `order is ${existing.status}` } }, 409);
    }

    const total = await recomputeTotal(orderId);
    // Fire-and-forget: don't make the agent wait on a getOrder round-trip
    // just so the dashboard can update. SSE fans out a tick after the response.
    getOrder(orderId).then((o) => bus.emitEvent({ type: "order_updated", data: o })).catch(() => {});
    return c.json({
      line_id: line.id,
      item_name: item.name,
      unit_price_cents: item.price_cents,
      running_total_cents: total,
    }, 201);
  },
);

ordersRouter.patch(
  "/orders/:id/items/:line_id",
  zValidator("json", z.object({
    quantity: z.number().int().min(1).max(99).optional(),
    modifiers: ModifiersSchema.optional(),
    notes: z.string().max(500).nullable().optional(),
  })),
  async (c) => {
    const orderId = Number(c.req.param("id"));
    const lineId = Number(c.req.param("line_id"));
    if (!Number.isFinite(orderId) || !Number.isFinite(lineId)) {
      return c.json({ error: { code: "bad_id", message: "invalid id" } }, 400);
    }
    const body = c.req.valid("json");
    const [orderRow] = await sql<Pick<Order, "status">[]>`SELECT status FROM orders WHERE id = ${orderId}`;
    if (!orderRow) return c.json({ error: { code: "not_found", message: "order not found" } }, 404);
    if (orderRow.status !== "open") return c.json({ error: { code: "order_locked", message: `order is ${orderRow.status}` } }, 409);

    if (body.quantity !== undefined) await sql`UPDATE order_lines SET quantity = ${body.quantity} WHERE id = ${lineId} AND order_id = ${orderId}`;
    if (body.modifiers !== undefined) await sql`UPDATE order_lines SET modifiers = ${sql.json(body.modifiers as never)} WHERE id = ${lineId} AND order_id = ${orderId}`;
    if (body.notes !== undefined) await sql`UPDATE order_lines SET notes = ${body.notes} WHERE id = ${lineId} AND order_id = ${orderId}`;

    const total = await recomputeTotal(orderId);
    // Fire-and-forget: don't make the agent wait on a getOrder round-trip
    // just so the dashboard can update. SSE fans out a tick after the response.
    getOrder(orderId).then((o) => bus.emitEvent({ type: "order_updated", data: o })).catch(() => {});
    return c.json({ line_id: lineId, running_total_cents: total });
  },
);

ordersRouter.delete("/orders/:id/items/:line_id", async (c) => {
  const orderId = Number(c.req.param("id"));
  const lineId = Number(c.req.param("line_id"));
  if (!Number.isFinite(orderId) || !Number.isFinite(lineId)) {
    return c.json({ error: { code: "bad_id", message: "invalid id" } }, 400);
  }
  const [order] = await sql<Pick<Order, "status">[]>`SELECT status FROM orders WHERE id = ${orderId}`;
  if (!order) return c.json({ error: { code: "not_found", message: "order not found" } }, 404);
  if (order.status !== "open") return c.json({ error: { code: "order_locked", message: `order is ${order.status}` } }, 409);
  const result = await sql`DELETE FROM order_lines WHERE id = ${lineId} AND order_id = ${orderId} RETURNING id`;
  if (result.count === 0) return c.json({ error: { code: "not_found", message: "line not found" } }, 404);
  const total = await recomputeTotal(orderId);
  getOrder(orderId).then((o) => bus.emitEvent({ type: "order_updated", data: o })).catch(() => {});
  return c.json({ running_total_cents: total });
});

// Reject obvious placeholder names — Gemini Flash sometimes fabricates one
// instead of asking the caller. Force the agent to retry.
const PLACEHOLDER_NAMES = new Set([
  "john doe", "jane doe", "john smith", "jane smith",
  "test", "test test", "test customer", "test name",
  "customer", "anonymous", "user", "guest",
  "n/a", "na", "none", "unknown", "no name", "noname",
  "first name last name",
]);

ordersRouter.post(
  "/orders/:id/submit",
  zValidator("json", z.object({ customer_name: z.string().min(1).max(80) })),
  async (c) => {
    const orderId = Number(c.req.param("id"));
    if (!Number.isFinite(orderId)) return c.json({ error: { code: "bad_id", message: "invalid id" } }, 400);
    const { customer_name } = c.req.valid("json");
    const normalized = customer_name.trim().toLowerCase();
    if (PLACEHOLDER_NAMES.has(normalized)) {
      return c.json({
        error: {
          code: "placeholder_name",
          message: "Customer name appears to be a placeholder. Ask the caller for their real first name and retry.",
        },
      }, 400);
    }
    try {
      await sql`UPDATE orders SET customer_name = ${customer_name} WHERE id = ${orderId}`;
      const result = await submitOrder(orderId);
      const order = (await getOrder(orderId))!;
      bus.emitEvent({ type: "order_submitted", data: order });
      return c.json(result);
    } catch (err) {
      if (err instanceof HttpError) {
        return c.json({ error: { code: err.code, message: err.message } }, err.status as 400);
      }
      throw err;
    }
  },
);

ordersRouter.post("/orders/:id/cancel", async (c) => {
  const orderId = Number(c.req.param("id"));
  if (!Number.isFinite(orderId)) return c.json({ error: { code: "bad_id", message: "invalid id" } }, 400);
  const result = await sql`UPDATE orders SET status = 'cancelled' WHERE id = ${orderId} AND status = 'open' RETURNING id`;
  if (result.count === 0) return c.json({ error: { code: "cannot_cancel", message: "order not open" } }, 409);
  getOrder(orderId).then((o) => bus.emitEvent({ type: "order_updated", data: o })).catch(() => {});
  return c.json({ status: "cancelled" });
});

ordersRouter.patch("/orders/:id/complete", async (c) => {
  const orderId = Number(c.req.param("id"));
  if (!Number.isFinite(orderId)) return c.json({ error: { code: "bad_id", message: "invalid id" } }, 400);
  const result = await sql`
    UPDATE orders SET status = 'completed', completed_at = now()
     WHERE id = ${orderId} AND status = 'submitted'
     RETURNING id
  `;
  if (result.count === 0) return c.json({ error: { code: "cannot_complete", message: "order not in submitted state" } }, 409);
  const order = (await getOrder(orderId))!;
  bus.emitEvent({ type: "order_completed", data: order });
  return c.json(order);
});
