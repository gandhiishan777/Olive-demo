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
  type OrderLine,
} from "../lib/order.js";
import { bus } from "../lib/events.js";
import { requireToken } from "../middleware/auth.js";
import { getCached, setCached } from "../lib/idempotency.js";
import { env } from "../lib/env.js";

function localPickupTime(isoUtc: string): string {
  // Format pickup ETA in the restaurant's timezone, e.g. "7:52 PM".
  try {
    return new Date(isoUtc).toLocaleTimeString("en-US", {
      timeZone: env.RESTAURANT_TIMEZONE,
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return isoUtc;
  }
}

export const ordersRouter = new Hono();
ordersRouter.use("*", requireToken);

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
    const idemKey = c.req.header("idempotency-key");
    if (idemKey) {
      const hit = getCached("orders:create", `${conversation_id}:${idemKey}`);
      if (hit) return c.json(hit.body as object, hit.status as 200);
    }

    // Re-use existing OPEN order for the same conversation.
    // Filtering by status='open' avoids soft-locking the agent on a cancelled/submitted order
    // (e.g. when /calls/ended auto-cancels and the same conversation_id is somehow reused).
    const existingRows = await sql<Pick<Order, "id">[]>`
      SELECT id FROM orders
       WHERE conversation_id = ${conversation_id} AND status = 'open'
       ORDER BY created_at DESC LIMIT 1
    `;
    if (existingRows[0]) {
      const order = (await getOrder(existingRows[0].id))!;
      const body = { id: order.id, status: order.status, total_cents: order.total_cents, order_number: order.order_number, lines: order.lines };
      if (idemKey) setCached("orders:create", `${conversation_id}:${idemKey}`, 200, body);
      return c.json(body, 200);
    }

    const [created] = await sql<[{ id: number }]>`
      INSERT INTO orders (status, conversation_id, customer_phone, total_cents)
      VALUES ('open', ${conversation_id}, ${customer_phone ?? null}, 0)
      RETURNING id
    `;
    const id = created!.id;
    const order = (await getOrder(id))!;
    const body = { id, status: "open", total_cents: 0, order_number: null, lines: [] };
    bus.emitEvent({ type: "order_created", data: order });
    if (idemKey) setCached("orders:create", `${conversation_id}:${idemKey}`, 201, body);
    return c.json(body, 201);
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
    const idemKey = c.req.header("idempotency-key");
    const idemScope = `orders:${orderId}:add_item`;
    if (idemKey) {
      const hit = getCached(idemScope, idemKey);
      if (hit) return c.json(hit.body as object, hit.status as 200);
    }

    const [item] = await sql<Item[]>`
      SELECT id, name, price_cents, in_stock, spice_levels
      FROM items WHERE id = ${item_id}
    `;
    if (!item) return c.json({ error: { code: "item_not_found", message: "item not found" } }, 404);
    if (!item.in_stock) return c.json({ error: { code: "item_out_of_stock", message: `${item.name} is currently unavailable` } }, 409);

    if (modifiers?.spice_level && item.spice_levels.length > 0 && !item.spice_levels.includes(modifiers.spice_level)) {
      return c.json({ error: { code: "invalid_modifier", message: `spice_level ${modifiers.spice_level} not available for ${item.name}` } }, 400);
    }
    if (modifiers?.spice_level && item.spice_levels.length === 0) {
      return c.json({ error: { code: "invalid_modifier", message: `${item.name} does not accept a spice level` } }, 400);
    }

    // Atomic: only INSERT if the order is still open. Closes the
    // submit-vs-add_item race (line lands on a submitted order otherwise).
    const inserted = await sql<Array<{ id: number }>>`
      INSERT INTO order_lines (order_id, item_id, item_name, quantity, unit_price_cents, modifiers, notes)
      SELECT ${orderId}, ${item.id}, ${item.name}, ${quantity}, ${item.price_cents}, ${sql.json((modifiers ?? {}) as never)}, ${notes ?? null}
       WHERE EXISTS (SELECT 1 FROM orders WHERE id = ${orderId} AND status = 'open')
      RETURNING id
    `;
    const line = inserted[0];
    if (!line) {
      // Either the order doesn't exist OR it was just locked. Disambiguate.
      const [existing] = await sql<Pick<Order, "status">[]>`SELECT status FROM orders WHERE id = ${orderId}`;
      if (!existing) return c.json({ error: { code: "not_found", message: "order not found" } }, 404);
      return c.json({ error: { code: "order_locked", message: `order is ${existing.status}` } }, 409);
    }
    const lineId = line.id;
    const total = await recomputeTotal(orderId);
    bus.emitEvent({ type: "order_updated", data: await getOrder(orderId) });
    const body = {
      line_id: lineId,
      item_name: item.name,
      unit_price_cents: item.price_cents,
      running_total_cents: total,
    };
    if (idemKey) setCached(idemScope, idemKey, 201, body);
    return c.json(body, 201);
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
    const [line] = await sql<OrderLine[]>`SELECT * FROM order_lines WHERE id = ${lineId} AND order_id = ${orderId}`;
    if (!line) return c.json({ error: { code: "not_found", message: "line not found" } }, 404);
    const [orderRow] = await sql<Pick<Order, "status">[]>`SELECT status FROM orders WHERE id = ${orderId}`;
    if (orderRow?.status !== "open") return c.json({ error: { code: "order_locked", message: `order is ${orderRow?.status}` } }, 409);

    if (body.modifiers !== undefined && body.modifiers.spice_level) {
      const [item] = await sql<Pick<Item, "name" | "spice_levels">[]>`SELECT name, spice_levels FROM items WHERE id = ${line.item_id}`;
      if (item && item.spice_levels.length > 0 && !item.spice_levels.includes(body.modifiers.spice_level)) {
        return c.json({ error: { code: "invalid_modifier", message: `spice_level not available for ${item.name}` } }, 400);
      }
    }

    // Build dynamic UPDATE using postgres.js fragments
    if (body.quantity !== undefined) await sql`UPDATE order_lines SET quantity = ${body.quantity} WHERE id = ${lineId}`;
    if (body.modifiers !== undefined) await sql`UPDATE order_lines SET modifiers = ${sql.json(body.modifiers as never)} WHERE id = ${lineId}`;
    if (body.notes !== undefined) await sql`UPDATE order_lines SET notes = ${body.notes} WHERE id = ${lineId}`;

    const total = await recomputeTotal(orderId);
    bus.emitEvent({ type: "order_updated", data: await getOrder(orderId) });
    return c.json({ line_id: lineId, running_total_cents: total });
  },
);

ordersRouter.delete("/orders/:id/items/:line_id", async (c) => {
  const orderId = Number(c.req.param("id"));
  const lineId = Number(c.req.param("line_id"));
  if (!Number.isFinite(orderId) || !Number.isFinite(lineId)) {
    return c.json({ error: { code: "bad_id", message: "invalid id" } }, 400);
  }
  const [orderRow] = await sql<Pick<Order, "status">[]>`SELECT status FROM orders WHERE id = ${orderId}`;
  if (!orderRow) return c.json({ error: { code: "not_found", message: "order not found" } }, 404);
  if (orderRow.status !== "open") return c.json({ error: { code: "order_locked", message: `order is ${orderRow.status}` } }, 409);
  const deleted = await sql`DELETE FROM order_lines WHERE id = ${lineId} AND order_id = ${orderId} RETURNING id`;
  if (deleted.count === 0) return c.json({ error: { code: "not_found", message: "line not found" } }, 404);
  const total = await recomputeTotal(orderId);
  bus.emitEvent({ type: "order_updated", data: await getOrder(orderId) });
  return c.json({ running_total_cents: total });
});

ordersRouter.post(
  "/orders/:id/submit",
  zValidator("json", z.object({ customer_name: z.string().min(1).max(80).optional() })),
  async (c) => {
    const orderId = Number(c.req.param("id"));
    if (!Number.isFinite(orderId)) return c.json({ error: { code: "bad_id", message: "invalid id" } }, 400);
    const { customer_name } = c.req.valid("json");
    const idemKey = c.req.header("idempotency-key");
    const idemScope = `orders:${orderId}:submit`;
    if (idemKey) {
      const hit = getCached(idemScope, idemKey);
      if (hit) return c.json(hit.body as object, hit.status as 200);
    }
    try {
      if (customer_name) {
        await sql`UPDATE orders SET customer_name = ${customer_name} WHERE id = ${orderId}`;
      }
      const result = await submitOrder(orderId);
      const order = (await getOrder(orderId))!;
      bus.emitEvent({ type: "order_submitted", data: order });
      const withLocalTime = { ...result, pickup_eta_local: localPickupTime(result.pickup_eta), timezone: env.RESTAURANT_TIMEZONE };
      if (idemKey) setCached(idemScope, idemKey, 200, withLocalTime);
      return c.json(withLocalTime);
    } catch (err) {
      if (err instanceof HttpError) {
        return c.json({ error: { code: err.code, message: err.message } }, err.status as 400);
      }
      // Postgres unique violation on order_number → translate to friendly 409
      // so the agent can recover instead of escalating.
      const pgErr = err as { code?: string } | undefined;
      if (pgErr?.code === "23505") {
        return c.json({ error: { code: "already_submitted", message: "order already submitted" } }, 409);
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
  bus.emitEvent({ type: "order_updated", data: await getOrder(orderId) });
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
