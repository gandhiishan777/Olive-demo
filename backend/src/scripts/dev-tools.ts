import { sql, closeDb } from "../db/index.js";
import { logger } from "../lib/logger.js";

const cmd = process.argv[2];

async function listOrders() {
  const rows = await sql`
    SELECT id, status, order_number, customer_phone, total_cents, created_at
    FROM orders ORDER BY created_at DESC LIMIT 50
  `;
  console.table([...rows]);
}

async function clearTestOrders() {
  await sql`DELETE FROM order_lines`;
  await sql`DELETE FROM orders`;
  logger.info("test orders cleared");
}

async function help() {
  console.log("dev-tools commands:");
  console.log("  list-orders         — show last 50 orders");
  console.log("  clear-test-orders   — wipe all orders + lines (KEEPS menu)");
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
