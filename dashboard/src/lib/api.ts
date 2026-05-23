// Dashboard talks to the backend through the Vite dev proxy:
//   /api/menu          → backend /menu
//   /orders/stream     → backend /orders/stream (no rewrite, since EventSource needs the literal path)
// In production, you'd serve dashboard behind the same origin or set VITE_API_BASE.

export const API_BASE = "/api";
export const STREAM_PATH = "/orders/stream";

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

export type CompactItem = Pick<Item, "id" | "name" | "price_cents" | "category" | "spice_levels" | "is_vegetarian"> & { short_desc: string };

export type OrderLine = {
  id: number;
  item_id: number;
  item_name: string;
  quantity: number;
  unit_price_cents: number;
  modifiers: Record<string, unknown>;
  notes: string | null;
};

export type Order = {
  id: number;
  status: "open" | "submitted" | "completed" | "cancelled";
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

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => fetchJson<{ ok: boolean; version: string }>(`${API_BASE}/healthz`),

  menuCompact: () => fetchJson<{ items: CompactItem[]; generated_at: string }>(`${API_BASE}/menu`),

  // All items, including out-of-stock — used by Menu panel for the 86 toggle
  allItems: () => fetchJson<{ items: Item[] }>(`${API_BASE}/items`).then((r) => r.items),

  toggleStock: (id: number, in_stock: boolean, token?: string) =>
    fetchJson<Item>(`${API_BASE}/items/${id}/stock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(token ? { "X-Olive-Token": token } : {}) },
      body: JSON.stringify({ in_stock }),
    }),

  ordersByStatus: (status?: Order["status"]) => {
    const q = status ? `?status=${status}` : "";
    return fetchJson<{ orders: Order[] }>(`${API_BASE}/orders${q}`).then((r) => r.orders);
  },

  markComplete: (id: number, token?: string) =>
    fetchJson<Order>(`${API_BASE}/orders/${id}/complete`, {
      method: "PATCH",
      headers: token ? { "X-Olive-Token": token } : {},
    }),
};
