import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { app } from "../index.js";
import { db } from "../db/index.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TOKEN = process.env.OLIVE_AGENT_TOKEN ?? "test-token-must-be-16-chars-plus";
process.env.OLIVE_AGENT_TOKEN = TOKEN;

function authHeaders(extra: Record<string, string> = {}) {
  return { "Content-Type": "application/json", "X-Olive-Token": TOKEN, ...extra };
}

function seedTestMenu() {
  const seedFile = path.resolve(__dirname, "../../../seed/placeholder_menu.json");
  const raw = JSON.parse(fs.readFileSync(seedFile, "utf8"));
  db.exec("DELETE FROM order_lines; DELETE FROM orders; DELETE FROM items;");
  const insert = db.prepare(
    `INSERT INTO items (id, name, description, price_cents, in_stock, allergens, spice_levels, prep_minutes, category, ingredients, is_vegetarian, is_vegan, is_gluten_free)
     VALUES (@id, @name, @description, @price_cents, @in_stock, @allergens, @spice_levels, @prep_minutes, @category, @ingredients, @is_vegetarian, @is_vegan, @is_gluten_free)`,
  );
  for (const i of raw.items) {
    insert.run({
      id: i.id,
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
}

beforeAll(() => seedTestMenu());
beforeEach(() => {
  db.exec("DELETE FROM order_lines; DELETE FROM orders;");
});

async function req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
  }
  const res = await app.request(path, init);
  const json = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, body: json };
}

describe("menu endpoints", () => {
  it("GET /menu returns only in-stock items", async () => {
    const r = await req("GET", "/menu");
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.items)).toBe(true);
    expect(r.body.items.length).toBeGreaterThan(0);
    expect(r.body.items.every((i: { name: string }) => !i.name.toLowerCase().includes("haleem"))).toBe(true);
  });

  it("GET /items/:id returns full item", async () => {
    const r = await req("GET", "/items/1");
    expect(r.status).toBe(200);
    expect(r.body.name).toBe("Chicken Biryani");
    expect(Array.isArray(r.body.ingredients)).toBe(true);
  });

  it("GET /menu/search fuzzy-matches typos", async () => {
    const r = await req("GET", "/menu/search?q=biriyani");
    expect(r.status).toBe(200);
    expect(r.body.matches.length).toBeGreaterThan(0);
    expect(r.body.matches[0].name.toLowerCase()).toContain("biryani");
  });
});

describe("auth", () => {
  it("rejects writes without token", async () => {
    const r = await req("POST", "/orders", { conversation_id: "test-1" });
    expect(r.status).toBe(401);
  });

  it("accepts writes with correct token", async () => {
    const r = await req("POST", "/orders", { conversation_id: "test-1" }, { "X-Olive-Token": TOKEN });
    expect(r.status).toBe(201);
    expect(r.body.status).toBe("open");
  });
});

describe("order lifecycle", () => {
  it("creates, adds items, modifies, submits", async () => {
    const create = await req("POST", "/orders", { conversation_id: "conv-2", customer_phone: "+14085551234" }, { "X-Olive-Token": TOKEN });
    expect(create.status).toBe(201);
    const oid = create.body.id;

    const addBiryani = await req("POST", `/orders/${oid}/items`, { item_id: 1, quantity: 1, modifiers: { spice_level: "medium" } }, { "X-Olive-Token": TOKEN });
    expect(addBiryani.status).toBe(201);
    expect(addBiryani.body.running_total_cents).toBe(1699);

    const addNaan = await req("POST", `/orders/${oid}/items`, { item_id: 7, quantity: 2 }, { "X-Olive-Token": TOKEN });
    expect(addNaan.status).toBe(201);
    expect(addNaan.body.running_total_cents).toBe(1699 + 399 * 2);

    const submit = await req("POST", `/orders/${oid}/submit`, { customer_name: "Raj" }, { "X-Olive-Token": TOKEN });
    expect(submit.status).toBe(200);
    expect(submit.body.order_number).toMatch(/^P-\d+$/);
    expect(submit.body.total_cents).toBe(1699 + 399 * 2);
    expect(submit.body.eta_minutes).toBeGreaterThan(0);
  });

  it("rejects out-of-stock item", async () => {
    const create = await req("POST", "/orders", { conversation_id: "conv-3" }, { "X-Olive-Token": TOKEN });
    const add = await req("POST", `/orders/${create.body.id}/items`, { item_id: 11 }, { "X-Olive-Token": TOKEN });
    expect(add.status).toBe(409);
    expect(add.body.error.code).toBe("item_out_of_stock");
  });

  it("rejects invalid spice_level", async () => {
    const create = await req("POST", "/orders", { conversation_id: "conv-4" }, { "X-Olive-Token": TOKEN });
    const add = await req("POST", `/orders/${create.body.id}/items`, { item_id: 7, modifiers: { spice_level: "mild" } }, { "X-Olive-Token": TOKEN });
    expect(add.status).toBe(400);
    expect(add.body.error.code).toBe("invalid_modifier");
  });

  it("rejects empty order submit", async () => {
    const create = await req("POST", "/orders", { conversation_id: "conv-5" }, { "X-Olive-Token": TOKEN });
    const submit = await req("POST", `/orders/${create.body.id}/submit`, {}, { "X-Olive-Token": TOKEN });
    expect(submit.status).toBe(409);
    expect(submit.body.error.code).toBe("order_empty");
  });

  it("idempotency-key dedupes add_item", async () => {
    const create = await req("POST", "/orders", { conversation_id: "conv-6" }, { "X-Olive-Token": TOKEN });
    const oid = create.body.id;
    const headers = { "X-Olive-Token": TOKEN, "Idempotency-Key": "abc123" };
    const a = await req("POST", `/orders/${oid}/items`, { item_id: 1 }, headers);
    const b = await req("POST", `/orders/${oid}/items`, { item_id: 1 }, headers);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.line_id).toBe(b.body.line_id); // same line, not duplicated
  });
});

describe("86 toggle", () => {
  it("PATCH /items/:id/stock flips in_stock", async () => {
    const r = await req("PATCH", "/items/1/stock", { in_stock: false }, { "X-Olive-Token": TOKEN });
    expect(r.status).toBe(200);
    expect(r.body.in_stock).toBe(false);
    const menu = await req("GET", "/menu");
    expect(menu.body.items.find((i: { id: number }) => i.id === 1)).toBeUndefined();
    // Restore for other tests
    await req("PATCH", "/items/1/stock", { in_stock: true }, { "X-Olive-Token": TOKEN });
  });
});

describe("health", () => {
  it("GET /healthz returns ok", async () => {
    const r = await req("GET", "/healthz");
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });
});
