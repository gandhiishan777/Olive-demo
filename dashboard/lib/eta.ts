import "server-only";
import { getSupabaseAdmin } from "./supabase-server";

/**
 * Queue buffer (minutes) added on top of the slowest prep time. Placeholder
 * for a real queue model — when there's no queue model yet, this approximates
 * "the kitchen has other orders cooking too." Bump when traffic ramps.
 */
export const QUEUE_BUFFER_MIN = 2;

/**
 * Computes a pickup ETA for an order.
 *
 *   pickup_eta = submittedAt + max(prep_minutes across this order's items) + QUEUE_BUFFER_MIN
 *
 * `max` (not sum) because the kitchen cooks lines in parallel — the order
 * goes out when the slowest item is ready. Items without prep_minutes are
 * treated as 0 (defensible because they're typically drinks / sides).
 */
export async function computePickupEta(
  orderId: number,
  submittedAt: Date,
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("order_lines")
    .select("items:item_id(prep_minutes)")
    .eq("order_id", orderId);

  if (error) throw new Error(`computePickupEta: ${error.message}`);

  let maxPrep = 0;
  for (const row of data ?? []) {
    // The joined `items` field is typed as a possibly-array by the Supabase
    // client; coerce defensively.
    const items = (row as { items: unknown }).items;
    const single = Array.isArray(items) ? items[0] : items;
    const m = (single as { prep_minutes: number | null } | null)?.prep_minutes;
    if (typeof m === "number" && m > maxPrep) maxPrep = m;
  }

  const etaMs = submittedAt.getTime() + (maxPrep + QUEUE_BUFFER_MIN) * 60_000;
  return new Date(etaMs).toISOString();
}
