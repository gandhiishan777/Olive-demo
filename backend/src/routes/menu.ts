import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { db } from "../db/index.js";
import { hydrateItem, type DbItem } from "../lib/order.js";
import { fuzzyScore } from "../lib/fuzzy.js";
import { bus } from "../lib/events.js";
import { requireToken } from "../middleware/auth.js";

export const menuRouter = new Hono();

menuRouter.get("/menu", (c) => {
  const rows = db.prepare("SELECT * FROM items WHERE in_stock = 1 ORDER BY category, id").all() as DbItem[];
  const items = rows.map((r) => {
    const item = hydrateItem(r);
    return {
      id: item.id,
      name: item.name,
      price_cents: item.price_cents,
      category: item.category,
      spice_levels: item.spice_levels,
      is_vegetarian: item.is_vegetarian,
      short_desc: item.description.split(/[.!]\s/)[0]?.slice(0, 80) ?? "",
    };
  });
  return c.json({ items, generated_at: new Date().toISOString() });
});

// List all items (in-stock + out). Used by the dashboard menu/86 panel.
// Public read: same posture as /menu. Stock changes still require token.
menuRouter.get("/items", (c) => {
  const rows = db.prepare("SELECT * FROM items ORDER BY category, name").all() as DbItem[];
  return c.json({ items: rows.map(hydrateItem) });
});

menuRouter.get("/items/:id", (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: { code: "bad_id", message: "invalid id" } }, 400);
  const row = db.prepare("SELECT * FROM items WHERE id = ?").get(id) as DbItem | undefined;
  if (!row) return c.json({ error: { code: "not_found", message: "item not found" } }, 404);
  return c.json(hydrateItem(row));
});

menuRouter.get(
  "/menu/search",
  zValidator("query", z.object({ q: z.string().min(1) })),
  (c) => {
    const { q } = c.req.valid("query");
    const rows = db.prepare("SELECT * FROM items WHERE in_stock = 1").all() as DbItem[];
    const matches = rows
      .map((r) => {
        const item = hydrateItem(r);
        return { id: item.id, name: item.name, in_stock: item.in_stock, score: fuzzyScore(q, item) };
      })
      .filter((m) => m.score >= 0.4)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    return c.json({ matches });
  },
);

menuRouter.patch(
  "/items/:id/stock",
  requireToken,
  zValidator("json", z.object({ in_stock: z.boolean() })),
  (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return c.json({ error: { code: "bad_id", message: "invalid id" } }, 400);
    const { in_stock } = c.req.valid("json");
    const result = db
      .prepare("UPDATE items SET in_stock = ?, updated_at = datetime('now') WHERE id = ?")
      .run(in_stock ? 1 : 0, id);
    if (result.changes === 0) return c.json({ error: { code: "not_found", message: "item not found" } }, 404);
    const row = db.prepare("SELECT * FROM items WHERE id = ?").get(id) as DbItem;
    bus.emitEvent({ type: "menu_update", data: { item_id: id, in_stock } });
    return c.json(hydrateItem(row));
  },
);
