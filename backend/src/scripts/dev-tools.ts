import { sql, closeDb } from "../db/index.js";
import { logger } from "../lib/logger.js";

const cmd = process.argv[2];
const flags = new Set(process.argv.slice(3));

async function listOrders() {
  const rows = await sql`
    SELECT id, status, order_number, customer_phone, total_cents, created_at
    FROM orders ORDER BY created_at DESC LIMIT 50
  `;
  console.table([...rows]);
}

async function clearTestOrders() {
  if (!flags.has("--yes")) {
    const [recent] = await sql<[{ n: string }]>`
      SELECT COUNT(*)::text AS n FROM orders
       WHERE status IN ('submitted','open') AND created_at > now() - interval '30 minutes'
    `;
    if (Number(recent?.n ?? 0) > 0) {
      console.error(`✗ Refusing — ${recent.n} active order(s) created in the last 30 minutes.`);
      console.error(`  This could be a live demo call. If you're sure, re-run with --yes.`);
      process.exit(1);
    }
    console.error(`✗ Refusing without --yes. This deletes ALL orders + lines.`);
    console.error(`  Run: pnpm dev-tools clear-test-orders --yes`);
    process.exit(1);
  }
  await sql`DELETE FROM order_lines`;
  await sql`DELETE FROM orders`;
  logger.info("test orders cleared");
}

async function help() {
  console.log("dev-tools commands:");
  console.log("  list-orders                       — show last 50 orders");
  console.log("  clear-test-orders --yes           — wipe all orders + lines (REQUIRES --yes,");
  console.log("                                       refuses if recent orders exist)");
}

async function main() {
  try {
    switch (cmd) {
      case "list-orders": await listOrders(); break;
      case "clear-test-orders": await clearTestOrders(); break;
      default: await help();
    }
  } finally {
    await closeDb();
  }
}

main();
