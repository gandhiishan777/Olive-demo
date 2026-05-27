// Dashboard → backend. Proxied through Vite dev server.
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
  health: () => fetchJson<{ ok: boolean }>(`${API_BASE}/healthz`),

  allItems: () => fetchJson<{ items: Item[] }>(`${API_BASE}/items`).then((r) => r.items),

  toggleStock: (id: number, in_stock: boolean) =>
    fetchJson<Item>(`${API_BASE}/items/${id}/stock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ in_stock }),
    }),

  ordersByStatus: (status?: Order["status"]) => {
    const q = status ? `?status=${status}` : "";
    return fetchJson<{ orders: Order[] }>(`${API_BASE}/orders${q}`).then((r) => r.orders);
  },

  markComplete: (id: number) =>
    fetchJson<Order>(`${API_BASE}/orders/${id}/complete`, { method: "PATCH" }),
};
