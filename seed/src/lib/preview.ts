import type { Menu } from "./schema.js";

export function preview(menu: Menu): string {
  const lines: string[] = [];
  lines.push(`Restaurant: ${menu.restaurant}`);
  lines.push(`Items: ${menu.items.length}`);
  lines.push("");
  lines.push("ID  CATEGORY    NAME                                    PRICE   FLAGS");
  lines.push("--  ----------  --------------------------------------  ------  ----------");
  menu.items.forEach((i, idx) => {
    const flags: string[] = [];
    if (i.is_vegetarian) flags.push("veg");
    if (i.is_vegan) flags.push("vegan");
    if (i.is_gluten_free) flags.push("gf");
    if (!i.in_stock) flags.push("86");
    if (i.allergens.length === 0) flags.push("⚠no-allergens");
    if (i.ingredients.length === 0) flags.push("⚠no-ingredients");
    const id = String(i.id ?? idx + 1).padStart(2);
    const cat = i.category.padEnd(10);
    const name = i.name.slice(0, 38).padEnd(38);
    const price = `$${(i.price_cents / 100).toFixed(2)}`.padStart(6);
    lines.push(`${id}  ${cat}  ${name}  ${price}  ${flags.join(" ")}`);
  });
  return lines.join("\n");
}
