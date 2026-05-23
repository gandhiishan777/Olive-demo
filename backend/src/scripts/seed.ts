import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { db } from "../db/index.js";
import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";

const MenuSchema = z.object({
  restaurant: z.string().optional(),
  currency: z.string().optional(),
  items: z.array(z.object({
    id: z.number().int().positive().optional(),
    name: z.string(),
    description: z.string().default(""),
    price_cents: z.number().int().nonnegative(),
    in_stock: z.boolean().default(true),
    allergens: z.array(z.string()).default([]),
    spice_levels: z.array(z.string()).default([]),
    prep_minutes: z.number().int().nonnegative().default(15),
    category: z.string(),
    ingredients: z.array(z.string()).default([]),
    is_vegetarian: z.boolean().default(false),
    is_vegan: z.boolean().default(false),
    is_gluten_free: z.boolean().default(false),
  })),
});

function resolveSeedFile(): string {
  const cliArg = process.argv[2];
  const p = cliArg ?? env.SEED_FILE;
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

function main() {
  const seedPath = resolveSeedFile();
  if (!fs.existsSync(seedPath)) {
    logger.error({ seedPath }, "seed file not found");
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(seedPath, "utf8"));
  const parsed = MenuSchema.safeParse(raw);
  if (!parsed.success) {
    logger.error({ issues: parsed.error.issues }, "invalid menu file");
    process.exit(1);
  }
  const { items } = parsed.data;

  const tx = db.transaction(() => {
    db.exec("DELETE FROM order_lines; DELETE FROM orders; DELETE FROM items;");
    const insert = db.prepare(
      `INSERT INTO items (id, name, description, price_cents, in_stock, allergens, spice_levels, prep_minutes, category, ingredients, is_vegetarian, is_vegan, is_gluten_free)
       VALUES (@id, @name, @description, @price_cents, @in_stock, @allergens, @spice_levels, @prep_minutes, @category, @ingredients, @is_vegetarian, @is_vegan, @is_gluten_free)`,
    );
    for (const i of items) {
      insert.run({
        id: i.id ?? null,
        name: i.name,
        description: i.description,
        price_cents: i.price_cents,
        in_stock: i.in_stock ? 1 : 0,
        allergens: JSON.stringify(i.allergens),
        spice_levels: JSON.stringify(i.spice_levels),
        prep_minutes: i.prep_minutes,
        category: i.category,
        ingredients: JSON.stringify(i.ingredients),
        is_vegetarian: i.is_vegetarian ? 1 : 0,
        is_vegan: i.is_vegan ? 1 : 0,
        is_gluten_free: i.is_gluten_free ? 1 : 0,
      });
    }
  });
  tx();
  logger.info({ count: items.length, file: seedPath }, "menu seeded");
}

main();
