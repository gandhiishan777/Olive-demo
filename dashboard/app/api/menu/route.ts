import { getSupabaseAdmin } from "@/lib/supabase-server";
import { httpError, json, withErrorHandler } from "@/lib/http";
import type { Item } from "@/lib/types";

export const dynamic = "force-dynamic";

const ITEM_COLUMNS =
  "id, name, description, price_cents, in_stock, allergens, spice_levels, prep_minutes, category, ingredients, is_vegetarian, is_vegan, is_gluten_free, updated_at";

export const GET = withErrorHandler(async () => {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("items")
    .select(ITEM_COLUMNS)
    .order("category", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });

  if (error) {
    console.error("[api/menu] select failed", error);
    return httpError(500, "INTERNAL", error.message);
  }

  return json(200, { items: (data ?? []) as Item[] });
});
