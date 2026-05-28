import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { sql } from "../db/index.js";
import type { Item } from "../lib/order.js";
import { fuzzyScore } from "../lib/fuzzy.js";
import { bus } from "../lib/events.js";

export const menuRouter = new Hono();

// FULL menu — every field the agent will ever need, including out-of-stock items.
// Designed to be called ONCE at the start of a call (auto-call-on-start) so the
// agent has all menu info in its context for the rest of the conversation.
// No more get_item_details / search_menu round-trips required.
// In-stock items come first.
menuRouter.get("/menu", async (c) => {
  const items = await sql<Item[]>`
    SELECT id, name, description, price_cents, in_stock,
           allergens, spice_levels, prep_minutes, category, ingredients,
           is_vegetarian, is_vegan, is_gluten_free
    FROM items
    ORDER BY in_stock DESC, category, id
  `;
  return c.json({ items: [...items], generated_at: new Date().toISOString() });
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
    // Search ALL items (incl. out-of-stock) so the agent can distinguish
    // "we don't carry that" (0 matches) from "we're out today" (matches with in_stock=false).
    const items = await sql<Array<Pick<Item, "id" | "name" | "description" | "in_stock">>>`
      SELECT id, name, description, in_stock FROM items
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
