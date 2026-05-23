import { sql, nextOrderNumber } from "../db/index.js";

export type Item = {
  id: number;
  name: string;
  description: string;
  price_cents: number;
  in_stock: boolean;
  allergens: string[];
  spice_levels: string[];
  prep_minutes: number;
  category: string;
  ingredients: string[];
  is_vegetarian: boolean;
  is_vegan: boolean;
  is_gluten_free: boolean;
};

export type OrderLine = {
  id: number;
  order_id: number;
  item_id: number;
  item_name: string;
  quantity: number;
  unit_price_cents: number;
  modifiers: Record<string, unknown>;
  notes: string | null;
  created_at?: string;
};

export type Order = {
  id: number;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  conversation_id: string | null;
  total_cents: number;
  order_number: string | null;
  created_at: string;
  submitted_at: string | null;
  completed_at: string | null;
  pickup_eta: string | null;
  lines: OrderLine[];
};

/**
 * Single-query order fetch using json_agg so we get a consistent snapshot
 * (no read-skew between the orders row and its lines).
 */
export async function getOrder(id: number): Promise<Order | undefined> {
  const rows = await sql<Order[]>`
    SELECT o.id, o.status, o.customer_name, o.customer_phone, o.conversation_id,
           o.total_cents, o.order_number, o.created_at, o.submitted_at,
           o.completed_at, o.pickup_eta,
           COALESCE(
             (SELECT json_agg(json_build_object(
                'id', l.id,
                'order_id', l.order_id,
                'item_id', l.item_id,
                'item_name', l.item_name,
                'quantity', l.quantity,
                'unit_price_cents', l.unit_price_cents,
                'modifiers', l.modifiers,
                'notes', l.notes
              ) ORDER BY l.id)
              FROM order_lines l WHERE l.order_id = o.id),
             '[]'::json
           ) AS lines
      FROM orders o WHERE o.id = ${id}
  `;
  return rows[0];
}

export async function recomputeTotal(orderId: number): Promise<number> {
  const [row] = await sql<[{ total: number }]>`
    UPDATE orders
       SET total_cents = COALESCE((
         SELECT SUM(quantity * unit_price_cents) FROM order_lines WHERE order_id = ${orderId}
       ), 0)
     WHERE id = ${orderId}
     RETURNING total_cents AS total
  `;
  return row?.total ?? 0;
}

/**
 * Atomic submit. Wraps the entire flow in a transaction. The terminal UPDATE
 * is gated on `status='open'`, so two concurrent submits cannot both succeed —
 * the loser sees zero affected rows and we raise `already_submitted`.
 *
 * Trades: the lost submit burns a sequence number (gaps are fine).
 */
export async function submitOrder(orderId: number): Promise<{
  order_number: string;
  total_cents: number;
  eta_minutes: number;
  pickup_eta: string;
}> {
  return sql.begin(async (tx) => {
    // Lock the order row for the duration of the tx so concurrent add_item / submit see a consistent view.
    const [order] = await tx<Array<{ status: string }>>`
      SELECT status FROM orders WHERE id = ${orderId} FOR UPDATE
    `;
    if (!order) throw new HttpError(404, "order_not_found", `order ${orderId} not found`);
    if (order.status !== "open") throw new HttpError(409, "already_submitted", `order is ${order.status}`);

    const lines = await tx<Array<{ item_id: number; quantity: number; unit_price_cents: number }>>`
      SELECT item_id, quantity, unit_price_cents FROM order_lines WHERE order_id = ${orderId}
    `;
    if (lines.length === 0) throw new HttpError(409, "order_empty", "cannot submit empty order");

    const itemIds = lines.map((l) => l.item_id);
    const items = await tx<Array<{ id: number; prep_minutes: number }>>`
      SELECT id, prep_minutes FROM items WHERE id = ANY(${itemIds})
    `;
    const prepMap = new Map(items.map((i) => [i.id, i.prep_minutes]));
    const maxPrep = lines.reduce((m, l) => Math.max(m, prepMap.get(l.item_id) ?? 15), 0);
    const etaMin = maxPrep + 2;

    const total = lines.reduce((sum, l) => sum + l.quantity * l.unit_price_cents, 0);
    const orderNumber = await nextOrderNumber(tx);
    const pickupEta = new Date(Date.now() + etaMin * 60_000).toISOString();

    const updated = await tx`
      UPDATE orders
         SET status = 'submitted',
             order_number = ${orderNumber},
             total_cents = ${total},
             submitted_at = NOW(),
             pickup_eta = ${pickupEta}
       WHERE id = ${orderId} AND status = 'open'
       RETURNING id
    `;
    if (updated.count === 0) {
      throw new HttpError(409, "already_submitted", "order was submitted by a concurrent request");
    }

    return { order_number: orderNumber, total_cents: total, eta_minutes: etaMin, pickup_eta: pickupEta };
  });
}

export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
