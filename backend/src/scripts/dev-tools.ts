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

async function clearOrders() {
  await sql`DELETE FROM order_lines`;
  await sql`DELETE FROM orders`;
  logger.info("all orders cleared");
}

function help() {
  console.log("dev-tools:");
  console.log("  list-orders     — show last 50 orders");
  console.log("  clear-orders    — wipe all orders + lines");
}

async function main() {
  try {
    switch (cmd) {
      case "list-orders": await listOrders(); break;
      case "clear-orders": await clearOrders(); break;
      default: help();
    }
  } finally {
    await closeDb();
  }
}

main();
