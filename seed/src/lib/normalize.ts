import type { Item } from "./schema.js";

const DEFAULT_PREP_BY_CATEGORY: Record<string, number> = {
  biryani: 22,
  curry: 18,
  appetizer: 12,
  bread: 6,
  dessert: 4,
  drink: 3,
  side: 8,
};

export function priceToCents(price: string | number): number {
  if (typeof price === "number") {
    // Already cents if integer >= 100, dollars if has decimals or < 100
    return Number.isInteger(price) && price >= 100 ? price : Math.round(price * 100);
  }
  const cleaned = price.trim().replace(/[$,\s]/g, "");
  const num = parseFloat(cleaned);
  if (Number.isNaN(num)) throw new Error(`Cannot parse price: ${JSON.stringify(price)}`);
  return Math.round(num * 100);
}

export function normalizeAllergens(tags: string[]): string[] {
  return tags.map((t) => t.toLowerCase().trim()).filter(Boolean);
}

export function inferCategory(name: string, descr = ""): string {
  const text = `${name} ${descr}`.toLowerCase();
  if (/biryani|biriyani/.test(text)) return "biryani";
  if (/naan|roti|paratha|kulcha/.test(text)) return "bread";
  if (/lassi|chai|tea|coffee|coke|water|drink/.test(text)) return "drink";
  if (/gulab|kheer|jamun|dessert|kulfi|halwa/.test(text)) return "dessert";
  if (/samosa|pakora|chaat|65|appetizer|starter/.test(text)) return "appetizer";
  if (/curry|masala|tikka|saag|paneer|korma|vindaloo|chicken|lamb|goat/.test(text)) return "curry";
  return "side";
}

export function inferPrep(category: string, override?: number): number {
  if (typeof override === "number" && override > 0) return override;
  return DEFAULT_PREP_BY_CATEGORY[category] ?? 15;
}

/**
 * Fill in best-effort defaults. We DO NOT guess ingredients/allergens —
 * those stay empty if unknown so the system prompt makes it visible.
 */
export function applyDefaults(item: Partial<Item> & { name: string; price_cents: number }): Item {
  const category = item.category && item.category !== "side" ? item.category : inferCategory(item.name, item.description);
  return {
    name: item.name,
    description: item.description ?? "",
    price_cents: item.price_cents,
    in_stock: item.in_stock ?? true,
    allergens: normalizeAllergens(item.allergens ?? []),
    spice_levels: item.spice_levels ?? [],
    prep_minutes: inferPrep(category, item.prep_minutes),
    category,
    ingredients: item.ingredients ?? [],
    is_vegetarian: item.is_vegetarian ?? false,
    is_vegan: item.is_vegan ?? false,
    is_gluten_free: item.is_gluten_free ?? false,
    ...(item.id !== undefined ? { id: item.id } : {}),
  };
}
