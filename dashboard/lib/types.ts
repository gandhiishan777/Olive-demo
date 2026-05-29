// Shared TypeScript types — match Supabase column shapes 1:1.

export type OrderStatus = "open" | "submitted" | "completed";

export type Item = {
  id: number;
  name: string;
  description: string | null;
  price_cents: number;
  in_stock: boolean;
  allergens: string[];
  spice_levels: string[]; // plural, text[] in DB
  prep_minutes: number | null;
  category: string | null;
  ingredients: string[];
  is_vegetarian: boolean | null;
  is_vegan: boolean | null;
  is_gluten_free: boolean | null;
  updated_at: string | null;
};

export type Order = {
  id: number;
  status: OrderStatus;
  customer_name: string | null;
  customer_phone: string | null;
  conversation_id: string | null;
  total_cents: number;
  created_at: string;
  submitted_at: string | null;
  completed_at: string | null;
  pickup_eta: string | null;
  order_number: string | null;
};

export type Modifiers = Record<string, unknown>;

export type OrderLine = {
  id: number;
  order_id: number;
  item_id: number;
  item_name: string; // snapshot
  quantity: number;
  unit_price_cents: number; // snapshot
  modifiers: Modifiers | null;
  notes: string | null;
};

export type OrderWithLines = Order & { order_lines: OrderLine[] };

// Canonical error codes returned by /api/* routes.
export type ApiErrorCode =
  | "INVALID_BODY"
  | "INVALID_QUANTITY"
  | "ITEM_NOT_FOUND"
  | "ITEM_OUT_OF_STOCK"
  | "ORDER_NOT_FOUND"
  | "LINE_NOT_FOUND"
  | "ORDER_LOCKED"
  | "INVALID_TRANSITION"
  | "EMPTY_ORDER"
  | "INTERNAL";
