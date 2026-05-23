import { db, nextOrderNumber } from "../db/index.js";

export type DbItem = {
  id: number;
  name: string;
  description: string;
  price_cents: number;
  in_stock: number;
  allergens: string;
  spice_levels: string;
  prep_minutes: number;
  category: string;
  ingredients: string;
  is_vegetarian: number;
  is_vegan: number;
  is_gluten_free: number;
};

export type DbOrder = {
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
};

export type DbOrderLine = {
  id: number;
  order_id: number;
  item_id: number;
  item_name: string;
  quantity: number;
  unit_price_cents: number;
  modifiers: string;
  notes: string | null;
};

export type Item = Omit<DbItem, "in_stock" | "is_vegetarian" | "is_vegan" | "is_gluten_free" | "allergens" | "spice_levels" | "ingredients"> & {
  in_stock: boolean;
  is_vegetarian: boolean;
  is_vegan: boolean;
  is_gluten_free: boolean;
  allergens: string[];
  spice_levels: string[];
  ingredients: string[];
};

export type OrderLine = Omit<DbOrderLine, "modifiers"> & {
  modifiers: Record<string, unknown>;
};

export type Order = DbOrder & { lines: OrderLine[] };

export function hydrateItem(row: DbItem): Item {
  return {
    ...row,
    in_stock: !!row.in_stock,
    is_vegetarian: !!row.is_vegetarian,
    is_vegan: !!row.is_vegan,
    is_gluten_free: !!row.is_gluten_free,
    allergens: JSON.parse(row.allergens),
    spice_levels: JSON.parse(row.spice_levels),
    ingredients: JSON.parse(row.ingredients),
  };
}

export function hydrateLine(row: DbOrderLine): OrderLine {
  return { ...row, modifiers: JSON.parse(row.modifiers) };
}

export function getOrder(id: number): Order | undefined {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as DbOrder | undefined;
  if (!order) return undefined;
  const lines = db.prepare("SELECT * FROM order_lines WHERE order_id = ? ORDER BY id").all(id) as DbOrderLine[];
  return { ...order, lines: lines.map(hydrateLine) };
}

const recomputeTotalTx = db.transaction((orderId: number): number => {
  const row = db
    .prepare("SELECT COALESCE(SUM(quantity * unit_price_cents), 0) AS total FROM order_lines WHERE order_id = ?")
    .get(orderId) as { total: number };
  db.prepare("UPDATE orders SET total_cents = ? WHERE id = ?").run(row.total, orderId);
  return row.total;
});

export function recomputeTotal(orderId: number): number {
  return recomputeTotalTx(orderId);
}

export function submitOrder(orderId: number): { order_number: string; total_cents: number; eta_minutes: number; pickup_eta: string } {
  const order = getOrder(orderId);
  if (!order) throw new HttpError(404, "order_not_found", `order ${orderId} not found`);
  if (order.status !== "open") throw new HttpError(409, "already_submitted", `order is ${order.status}`);
  if (order.lines.length === 0) throw new HttpError(409, "order_empty", "cannot submit empty order");

  // Compute ETA: max prep_minutes across lines × 1 + small buffer
  const items = db
    .prepare(`SELECT id, prep_minutes FROM items WHERE id IN (${order.lines.map(() => "?").join(",")})`)
    .all(...order.lines.map((l) => l.item_id)) as Array<{ id: number; prep_minutes: number }>;

  const prepMap = new Map(items.map((i) => [i.id, i.prep_minutes]));
  const maxPrep = order.lines.reduce((m, l) => Math.max(m, prepMap.get(l.item_id) ?? 15), 0);
  const etaMin = maxPrep + 2; // 2-min kitchen-pickup buffer
  const total = recomputeTotal(orderId);
  const orderNumber = nextOrderNumber();
  const pickupEta = new Date(Date.now() + etaMin * 60_000).toISOString();

  db.prepare(
    `UPDATE orders
     SET status='submitted', order_number=?, submitted_at=datetime('now'), pickup_eta=?
     WHERE id=?`,
  ).run(orderNumber, pickupEta, orderId);

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
