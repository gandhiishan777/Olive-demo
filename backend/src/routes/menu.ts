import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { sql } from "../db/index.js";
import type { Item } from "../lib/order.js";
import { fuzzyScore } from "../lib/fuzzy.js";
import { bus } from "../lib/events.js";

export const menuRouter = new Hono();

// Compact menu — in-stock only. Used by the agent.
menuRouter.get("/menu", async (c) => {
  const items = await sql<Item[]>`
    SELECT id, name, description, price_cents, category, spice_levels, is_vegetarian
    FROM items
    WHERE in_stock = true
    ORDER BY category, id
  `;
  const compact = items.map((i) => ({
    id: i.id,
    name: i.name,
    price_cents: i.price_cents,
    category: i.category,
    spice_levels: i.spice_levels,
    is_vegetarian: i.is_vegetarian,
    short_desc: (i.description ?? "").split(/[.!]\s/)[0]?.slice(0, 80) ?? "",
  }));
  return c.json({ items: compact, generated_at: new Date().toISOString() });
});

// All items (incl. out-of-stock) — used by dashboard menu/86 panel.
menuRouter.get("/items", async (c) => {
  const items = await sql<Item[]>`
    SELECT id, name, description, price_cents, in_stock, allergens, spice_levels,
           prep_minutes, category, ingredients, is_vegetarian, is_vegan, is_gluten_free
    FROM items
    ORDER BY category, name
  `;
  return c.json({ items: [...items] });
});

menuRouter.get("/items/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: { code: "bad_id", message: "invalid id" } }, 400);
  const [item] = await sql<Item[]>`
    SELECT id, name, description, price_cents, in_stock, allergens, spice_levels,
           prep_minutes, category, ingredients, is_vegetarian, is_vegan, is_gluten_free
    FROM items WHERE id = ${id}
  `;
  if (!item) return c.json({ error: { code: "not_found", message: "item not found" } }, 404);
  return c.json(item);
});

menuRouter.get(
  "/menu/search",
  zValidator("query", z.object({ q: z.string().min(1) })),
  async (c) => {
    const { q } = c.req.valid("query");
    const items = await sql<Array<Pick<Item, "id" | "name" | "description" | "in_stock">>>`
      SELECT id, name, description, in_stock FROM items WHERE in_stock = true
    `;
    const matches = items
      .map((i) => ({ id: i.id, name: i.name, in_stock: i.in_stock, score: fuzzyScore(q, i) }))
      .filter((m) => m.score >= 0.35)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    return c.json({ matches });
  },
);

menuRouter.patch(
  "/items/:id/stock",
  zValidator("json", z.object({ in_stock: z.boolean() })),
  async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return c.json({ error: { code: "bad_id", message: "invalid id" } }, 400);
    const { in_stock } = c.req.valid("json");
    const rows = await sql<Item[]>`
      UPDATE items SET in_stock = ${in_stock}, updated_at = now() WHERE id = ${id}
      RETURNING id, name, description, price_cents, in_stock, allergens, spice_levels,
                prep_minutes, category, ingredients, is_vegetarian, is_vegan, is_gluten_free
    `;
    if (rows.length === 0) return c.json({ error: { code: "not_found", message: "item not found" } }, 404);
    bus.emitEvent({ type: "menu_update", data: { item_id: id, in_stock } });
    return c.json(rows[0]);
  },
);
