import "server-only";
import { getSupabaseAdmin } from "./supabase-server";

/**
 * Recomputes orders.total_cents from its order_lines. SELECT-all then UPDATE —
 * not delta math. Idempotent: any earlier partial failure can't corrupt the
 * total. Tiny in practice (≤~10 lines per order).
 *
 * Returns the new total.
 */
export async function recomputeOrderTotal(orderId: number): Promise<number> {
  const supabase = getSupabaseAdmin();

  const { data: lines, error: linesErr } = await supabase
    .from("order_lines")
    .select("quantity, unit_price_cents")
    .eq("order_id", orderId);

  if (linesErr) {
    throw new Error(`recomputeOrderTotal: ${linesErr.message}`);
  }

  const total = (lines ?? []).reduce(
    (sum, l) => sum + l.quantity * l.unit_price_cents,
    0,
  );

  const { error: updateErr } = await supabase
    .from("orders")
    .update({ total_cents: total })
    .eq("id", orderId);

  if (updateErr) {
    throw new Error(`recomputeOrderTotal update: ${updateErr.message}`);
  }

  return total;
}
