import fs from "node:fs";
import { parse } from "csv-parse/sync";
import { MenuSchema, type Item, type Menu, SpiceLevel } from "../lib/schema.js";
import { applyDefaults, priceToCents } from "../lib/normalize.js";

/** Expected CSV columns (case-insensitive, all optional except name + price):
 *   name, description, price, category, allergens, spice_levels, ingredients,
 *   is_vegetarian, is_vegan, is_gluten_free, prep_minutes, in_stock
 *   Multi-value columns (allergens, spice_levels, ingredients) use ";" separator.
 */
export function parseCsvFile(path: string): Menu {
  const text = fs.readFileSync(path, "utf8");
  const rows = parse(text, { columns: (h) => h.map((c: string) => c.toLowerCase().trim()), skip_empty_lines: true, trim: true }) as Record<string, string>[];

  const items: Item[] = rows.map((r, idx) => {
    if (!r.name) throw new Error(`Row ${idx + 1}: missing 'name'`);
    if (!r.price) throw new Error(`Row ${idx + 1}: missing 'price'`);
    const split = (v?: string) => (v ? v.split(/[;,]/).map((s) => s.trim()).filter(Boolean) : []);
    const validSpices = split(r.spice_levels)
      .map((s) => s.toLowerCase().replace(" ", "_").replace("-", "_"))
      .filter((s): s is z.infer<typeof SpiceLevel> => SpiceLevel.options.includes(s as typeof SpiceLevel.options[number]));

    return applyDefaults({
      name: r.name,
      description: r.description ?? "",
      price_cents: priceToCents(r.price),
      category: r.category?.toLowerCase(),
      allergens: split(r.allergens),
      spice_levels: validSpices,
      ingredients: split(r.ingredients),
      prep_minutes: r.prep_minutes ? Number(r.prep_minutes) : undefined,
      is_vegetarian: parseBool(r.is_vegetarian),
      is_vegan: parseBool(r.is_vegan),
      is_gluten_free: parseBool(r.is_gluten_free),
      in_stock: r.in_stock === undefined ? true : parseBool(r.in_stock),
    });
  });

  return MenuSchema.parse({ items });
}

function parseBool(v: string | undefined): boolean {
  if (!v) return false;
  return ["true", "yes", "y", "1"].includes(v.toLowerCase().trim());
}

// re-export zod for the inline type above without polluting consumers
import type { z } from "zod";
