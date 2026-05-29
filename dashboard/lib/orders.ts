import "server-only";
import { getSupabaseAdmin } from "./supabase-server";
import type { OrderStatus } from "./types";

/**
 * Loads an order's id+status. Returns null if missing.
 * Centralized so every line-mutation route enforces the same lock check.
 */
export async function getOrderStatus(
  orderId: number,
): Promise<{ id: number; status: OrderStatus } | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(`getOrderStatus: ${error.message}`);
  if (!data) return null;
  return data as { id: number; status: OrderStatus };
}
