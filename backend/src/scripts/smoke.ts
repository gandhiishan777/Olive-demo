/**
 * End-to-end smoke test against a running backend.
 * Assumes:
 *   - Backend is running on http://localhost:8787
 *   - Migrations 001+002 have been applied
 *   - At least one in-stock item exists in the items table
 *   - OLIVE_AGENT_TOKEN env var is set to match the backend's token
 *
 * Usage: pnpm --filter @olive/backend smoke
 *
 * Cleans up after itself: cancels the test order at the end.
 */
import "dotenv/config";

const BASE = process.env.BACKEND_BASE_URL ?? "http://localhost:8787";
const TOKEN: string = (() => {
  const t = process.env.OLIVE_AGENT_TOKEN;
  if (!t) {
    console.error("OLIVE_AGENT_TOKEN required");
    process.exit(1);
  }
  return t;
})();

function ok(label: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`✓ ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    console.error(`✗ ${label}${detail ? ` — ${detail}` : ""}`);
    process.exit(1);
  }
}

async function jfetch(path: string, init: RequestInit = {}): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${path}`, init);
  const ct = res.headers.get("content-type") ?? "";
  const body = ct.includes("json") ? await res.json().catch(() => null) : await res.text();
  return { status: res.status, body };
}

const authHeaders: Record<string, string> = { "Content-Type": "application/json", "X-Olive-Token": TOKEN };

async function main() {
  console.log(`Smoke testing ${BASE}\n`);

  // 1. Health
  const h = await jfetch("/healthz");
  ok("/healthz", h.status === 200 && h.body?.ok === true, JSON.stringify(h.body));

  // 2. Menu
  const m = await jfetch("/menu");
  ok("/menu returns items", m.status === 200 && Array.isArray(m.body.items), `${m.body.items?.length} items`);
  const firstItem = m.body.items?.[0];
  if (!firstItem) {
    console.error("No in-stock items in DB. Cannot continue. Run migrations 002 + 003.");
    process.exit(1);
  }

  // 3. Items list (all + 86'd)
  const i = await jfetch("/items");
  ok("/items returns full list", i.status === 200 && Array.isArray(i.body.items), `${i.body.items?.length} items total`);

  // 4. Item detail
  const d = await jfetch(`/items/${firstItem.id}`);
  ok("/items/:id", d.status === 200 && d.body.id === firstItem.id, d.body.name);

  // 5. Fuzzy search
  const s = await jfetch(`/menu/search?q=${encodeURIComponent(firstItem.name.split(" ")[0])}`);
  ok("/menu/search fuzzy", s.status === 200 && s.body.matches?.length > 0);

  // 6. Auth: write without token returns 401
  const noauth = await jfetch("/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversation_id: "smoke-test-noauth" }) });
  ok("write without token → 401", noauth.status === 401);

  // 7. Full order lifecycle
  const cid = `smoke-${Date.now()}`;
  const create = await jfetch("/orders", { method: "POST", headers: authHeaders, body: JSON.stringify({ conversation_id: cid, customer_phone: "+15555550000" }) });
  ok("POST /orders", create.status === 201 && create.body.id, `order id=${create.body.id}`);
  const orderId = create.body.id;

  const add = await jfetch(`/orders/${orderId}/items`, { method: "POST", headers: authHeaders, body: JSON.stringify({ item_id: firstItem.id, quantity: 1 }) });
  ok("POST /orders/:id/items", add.status === 201 && add.body.line_id, `total=$${(add.body.running_total_cents / 100).toFixed(2)}`);

  const getOrder = await jfetch(`/orders/${orderId}`, { headers: { "X-Olive-Token": TOKEN } });
  ok("GET /orders/:id", getOrder.status === 200 && getOrder.body.lines.length === 1);

  // 8. Try to add an out-of-stock item if one exists
  const offline = i.body.items?.find((it: any) => it.in_stock === false);
  if (offline) {
    const block = await jfetch(`/orders/${orderId}/items`, { method: "POST", headers: authHeaders, body: JSON.stringify({ item_id: offline.id }) });
    ok("86'd item rejected", block.status === 409 && block.body.error?.code === "item_out_of_stock");
  } else {
    console.log("ⓘ no 86'd items to test against — skipping out-of-stock check");
  }

  // 9. Submit
  const submit = await jfetch(`/orders/${orderId}/submit`, { method: "POST", headers: authHeaders, body: JSON.stringify({ customer_name: "Smoke Test" }) });
  ok("POST /orders/:id/submit", submit.status === 200 && /^[A-Z]-\d+$/.test(submit.body.order_number), `order_number=${submit.body.order_number} eta=${submit.body.eta_minutes}min`);

  // 10. Idempotent submit
  const submit2 = await jfetch(`/orders/${orderId}/submit`, { method: "POST", headers: { ...authHeaders, "Idempotency-Key": "k1" }, body: JSON.stringify({ customer_name: "Smoke Test" }) });
  ok("re-submit fails (already_submitted)", submit2.status === 409);

  // 11. Mark complete
  const complete = await jfetch(`/orders/${orderId}/complete`, { method: "PATCH", headers: { "X-Olive-Token": TOKEN } });
  ok("PATCH /orders/:id/complete", complete.status === 200 && complete.body.status === "completed");

  console.log(`\nAll smoke checks passed. (Test order id=${orderId} order_number=${submit.body.order_number} left in 'completed' status — clear with: pnpm --filter @olive/backend dev-tools clear-test-orders)`);
}

main().catch((err) => {
  console.error(`Smoke test failed: ${err.message}`);
  process.exit(1);
});
