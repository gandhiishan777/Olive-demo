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

export async function getOrder(id: number): Promise<Order | undefined> {
  const orderRows = await sql<Omit<Order, "lines">[]>`
    SELECT id, status, customer_name, customer_phone, conversation_id, total_cents,
           order_number, created_at, submitted_at, completed_at, pickup_eta
    FROM orders WHERE id = ${id}
  `;
  const order = orderRows[0];
  if (!order) return undefined;
  const lines = await sql<OrderLine[]>`
    SELECT id, order_id, item_id, item_name, quantity, unit_price_cents, modifiers, notes
    FROM order_lines WHERE order_id = ${id} ORDER BY id
  `;
  return { ...order, lines: [...lines] };
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

export async function submitOrder(orderId: number): Promise<{
  order_number: string;
  total_cents: number;
  eta_minutes: number;
  pickup_eta: string;
}> {
  const order = await getOrder(orderId);
  if (!order) throw new HttpError(404, "order_not_found", `order ${orderId} not found`);
  if (order.status !== "open") throw new HttpError(409, "already_submitted", `order is ${order.status}`);
  if (order.lines.length === 0) throw new HttpError(409, "order_empty", "cannot submit empty order");

  // Fetch prep_minutes for every line's item
  const itemIds = order.lines.map((l) => l.item_id);
  const items = await sql<Array<{ id: number; prep_minutes: number }>>`
    SELECT id, prep_minutes FROM items WHERE id = ANY(${itemIds})
  `;
  const prepMap = new Map(items.map((i) => [i.id, i.prep_minutes]));
  const maxPrep = order.lines.reduce((m, l) => Math.max(m, prepMap.get(l.item_id) ?? 15), 0);
  const etaMin = maxPrep + 2; // 2-min kitchen-pickup buffer

  const total = await recomputeTotal(orderId);
  const orderNumber = await nextOrderNumber();
  const pickupEta = new Date(Date.now() + etaMin * 60_000).toISOString();

  await sql`
    UPDATE orders
       SET status = 'submitted',
           order_number = ${orderNumber},
           submitted_at = NOW(),
           pickup_eta = ${pickupEta}
     WHERE id = ${orderId}
  `;

  return { order_number: orderNumber, total_cents: total, eta_minutes: etaMin, pickup_eta: pickupEta };
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
