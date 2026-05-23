import fs from "node:fs";
import { MenuSchema, ItemSchema, type Item, type Menu } from "../lib/schema.js";
import { applyDefaults } from "../lib/normalize.js";

export function parseJsonFile(path: string): Menu {
  const raw = JSON.parse(fs.readFileSync(path, "utf8"));

  // Allow either {items: [...]} or just [...]
  const candidate = Array.isArray(raw) ? { items: raw } : raw;

  const items: Item[] = (candidate.items as unknown[]).map((raw, idx) => {
    const partial = raw as Record<string, unknown>;
    // Permit dollar-string prices in JSON: convert before schema validation
    if (typeof partial.price === "string" || typeof partial.price === "number") {
      partial.price_cents = typeof partial.price === "number" && Number.isInteger(partial.price) && partial.price >= 100
        ? partial.price
        : Math.round(Number(String(partial.price).replace(/[$,]/g, "")) * 100);
      delete partial.price;
    }
    const parsed = ItemSchema.partial({ description: true, in_stock: true, allergens: true, spice_levels: true, prep_minutes: true, category: true, ingredients: true, is_vegetarian: true, is_vegan: true, is_gluten_free: true })
      .extend({ name: ItemSchema.shape.name, price_cents: ItemSchema.shape.price_cents })
      .safeParse(partial);
    if (!parsed.success) {
      throw new Error(`Item ${idx} invalid: ${parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ")}`);
    }
    return applyDefaults(parsed.data);
  });

  return MenuSchema.parse({ ...(candidate as object), items });
}
