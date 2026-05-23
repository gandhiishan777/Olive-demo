import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { db } from "../db/index.js";
import {
  getOrder,
  hydrateItem,
  hydrateLine,
  recomputeTotal,
  submitOrder,
  HttpError,
  type DbItem,
  type DbOrder,
  type DbOrderLine,
} from "../lib/order.js";
import { bus } from "../lib/events.js";
import { requireToken } from "../middleware/auth.js";
import { getCached, setCached } from "../lib/idempotency.js";

export const ordersRouter = new Hono();

// All write endpoints require auth.
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
  (c) => {
    const { conversation_id, customer_phone } = c.req.valid("json");
    const idemKey = c.req.header("idempotency-key");
    if (idemKey) {
      const hit = getCached("orders:create", `${conversation_id}:${idemKey}`);
      if (hit) return c.json(hit.body as object, hit.status as 200);
    }

    // Re-use existing open order for the same conversation, if any
    const existing = db.prepare("SELECT * FROM orders WHERE conversation_id = ?").get(conversation_id) as DbOrder | undefined;
    if (existing) {
      const order = getOrder(existing.id)!;
      const body = { id: order.id, status: order.status, total_cents: order.total_cents, order_number: order.order_number, lines: order.lines };
      if (idemKey) setCached("orders:create", `${conversation_id}:${idemKey}`, 200, body);
      return c.json(body, 200);
    }

    const result = db
      .prepare("INSERT INTO orders (status, conversation_id, customer_phone) VALUES ('open', ?, ?)")
      .run(conversation_id, customer_phone ?? null);
    const id = Number(result.lastInsertRowid);
    const order = getOrder(id)!;
    const body = { id, status: "open", total_cents: 0, order_number: null, lines: [] };
    bus.emitEvent({ type: "order_created", data: order });
    if (idemKey) setCached("orders:create", `${conversation_id}:${idemKey}`, 201, body);
    return c.json(body, 201);
  },
);

ordersRouter.get("/orders/:id", (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: { code: "bad_id", message: "invalid id" } }, 400);
  const order = getOrder(id);
  if (!order) return c.json({ error: { code: "not_found", message: "order not found" } }, 404);
  return c.json(order);
});

// List for dashboard
ordersRouter.get(
  "/orders",
  zValidator("query", z.object({
    status: z.enum(["open", "submitted", "completed", "cancelled"]).optional(),
    limit: z.coerce.number().int().positive().max(200).optional(),
  })),
  (c) => {
    const { status, limit = 50 } = c.req.valid("query");
    const where = status ? "WHERE status = ?" : "";
    const stmt = db.prepare(`SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT ?`);
    const rows = (status ? stmt.all(status, limit) : stmt.all(limit)) as DbOrder[];
    const orders = rows.map((r) => getOrder(r.id)!);
    return c.json({ orders });
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
  (c) => {
    const orderId = Number(c.req.param("id"));
    if (!Number.isFinite(orderId)) return c.json({ error: { code: "bad_id", message: "invalid id" } }, 400);
    const { item_id, quantity, modifiers, notes } = c.req.valid("json");
    const idemKey = c.req.header("idempotency-key");
    const idemScope = `orders:${orderId}:add_item`;
    if (idemKey) {
      const hit = getCached(idemScope, idemKey);
      if (hit) return c.json(hit.body as object, hit.status as 200);
    }

    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as DbOrder | undefined;
    if (!order) return c.json({ error: { code: "not_found", message: "order not found" } }, 404);
    if (order.status !== "open") return c.json({ error: { code: "order_locked", message: `order is ${order.status}` } }, 409);

    const itemRow = db.prepare("SELECT * FROM items WHERE id = ?").get(item_id) as DbItem | undefined;
    if (!itemRow) return c.json({ error: { code: "item_not_found", message: "item not found" } }, 404);
    const item = hydrateItem(itemRow);
    if (!item.in_stock) {
      return c.json({ error: { code: "item_out_of_stock", message: `${item.name} is currently unavailable` } }, 409);
    }

    // Validate modifiers
    if (modifiers?.spice_level && item.spice_levels.length > 0 && !item.spice_levels.includes(modifiers.spice_level)) {
      return c.json(
        { error: { code: "invalid_modifier", message: `spice_level ${modifiers.spice_level} not available for ${item.name}` } },
        400,
      );
    }
    if (modifiers?.spice_level && item.spice_levels.length === 0) {
      return c.json(
        { error: { code: "invalid_modifier", message: `${item.name} does not accept a spice level` } },
        400,
      );
    }

    const result = db
      .prepare(
        `INSERT INTO order_lines (order_id, item_id, item_name, quantity, unit_price_cents, modifiers, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(orderId, item.id, item.name, quantity, item.price_cents, JSON.stringify(modifiers ?? {}), notes ?? null);

    const lineId = Number(result.lastInsertRowid);
    const total = recomputeTotal(orderId);
    bus.emitEvent({ type: "order_updated", data: getOrder(orderId) });
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
  (c) => {
    const orderId = Number(c.req.param("id"));
    const lineId = Number(c.req.param("line_id"));
    if (!Number.isFinite(orderId) || !Number.isFinite(lineId)) {
      return c.json({ error: { code: "bad_id", message: "invalid id" } }, 400);
    }
    const body = c.req.valid("json");
    const line = db.prepare("SELECT * FROM order_lines WHERE id = ? AND order_id = ?").get(lineId, orderId) as DbOrderLine | undefined;
    if (!line) return c.json({ error: { code: "not_found", message: "line not found" } }, 404);
    const order = db.prepare("SELECT status FROM orders WHERE id = ?").get(orderId) as { status: string } | undefined;
    if (order?.status !== "open") return c.json({ error: { code: "order_locked", message: `order is ${order?.status}` } }, 409);

    if (body.modifiers !== undefined) {
      const item = hydrateItem(db.prepare("SELECT * FROM items WHERE id = ?").get(line.item_id) as DbItem);
      if (body.modifiers.spice_level && item.spice_levels.length > 0 && !item.spice_levels.includes(body.modifiers.spice_level)) {
        return c.json(
          { error: { code: "invalid_modifier", message: `spice_level not available for ${item.name}` } },
          400,
        );
      }
    }

    const fields: string[] = [];
    const params: unknown[] = [];
    if (body.quantity !== undefined) { fields.push("quantity = ?"); params.push(body.quantity); }
    if (body.modifiers !== undefined) { fields.push("modifiers = ?"); params.push(JSON.stringify(body.modifiers)); }
    if (body.notes !== undefined) { fields.push("notes = ?"); params.push(body.notes); }
    if (fields.length === 0) return c.json({ line_id: lineId, running_total_cents: recomputeTotal(orderId) });
    params.push(lineId);
    db.prepare(`UPDATE order_lines SET ${fields.join(", ")} WHERE id = ?`).run(...params);
    const total = recomputeTotal(orderId);
    bus.emitEvent({ type: "order_updated", data: getOrder(orderId) });
    return c.json({ line_id: lineId, running_total_cents: total });
  },
);

ordersRouter.delete("/orders/:id/items/:line_id", (c) => {
  const orderId = Number(c.req.param("id"));
  const lineId = Number(c.req.param("line_id"));
  if (!Number.isFinite(orderId) || !Number.isFinite(lineId)) {
    return c.json({ error: { code: "bad_id", message: "invalid id" } }, 400);
  }
  const order = db.prepare("SELECT status FROM orders WHERE id = ?").get(orderId) as { status: string } | undefined;
  if (!order) return c.json({ error: { code: "not_found", message: "order not found" } }, 404);
  if (order.status !== "open") return c.json({ error: { code: "order_locked", message: `order is ${order.status}` } }, 409);
  const result = db.prepare("DELETE FROM order_lines WHERE id = ? AND order_id = ?").run(lineId, orderId);
  if (result.changes === 0) return c.json({ error: { code: "not_found", message: "line not found" } }, 404);
  const total = recomputeTotal(orderId);
  bus.emitEvent({ type: "order_updated", data: getOrder(orderId) });
  return c.json({ running_total_cents: total });
});

ordersRouter.post(
  "/orders/:id/submit",
  zValidator("json", z.object({ customer_name: z.string().min(1).max(80).optional() })),
  (c) => {
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
        db.prepare("UPDATE orders SET customer_name = ? WHERE id = ?").run(customer_name, orderId);
      }
      const result = submitOrder(orderId);
      const order = getOrder(orderId)!;
      bus.emitEvent({ type: "order_submitted", data: order });
      if (idemKey) setCached(idemScope, idemKey, 200, result);
      return c.json(result);
    } catch (err) {
      if (err instanceof HttpError) {
        return c.json({ error: { code: err.code, message: err.message } }, err.status as 400);
      }
      throw err;
    }
  },
);

ordersRouter.post("/orders/:id/cancel", (c) => {
  const orderId = Number(c.req.param("id"));
  if (!Number.isFinite(orderId)) return c.json({ error: { code: "bad_id", message: "invalid id" } }, 400);
  const result = db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ? AND status = 'open'").run(orderId);
  if (result.changes === 0) return c.json({ error: { code: "cannot_cancel", message: "order not open" } }, 409);
  bus.emitEvent({ type: "order_updated", data: getOrder(orderId) });
  return c.json({ status: "cancelled" });
});

ordersRouter.patch("/orders/:id/complete", (c) => {
  const orderId = Number(c.req.param("id"));
  if (!Number.isFinite(orderId)) return c.json({ error: { code: "bad_id", message: "invalid id" } }, 400);
  const result = db
    .prepare("UPDATE orders SET status = 'completed', completed_at = datetime('now') WHERE id = ? AND status = 'submitted'")
    .run(orderId);
  if (result.changes === 0) return c.json({ error: { code: "cannot_complete", message: "order not in submitted state" } }, 409);
  const order = getOrder(orderId)!;
  bus.emitEvent({ type: "order_completed", data: order });
  return c.json(order);
});
