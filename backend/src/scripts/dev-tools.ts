import { db } from "../db/index.js";
import { logger } from "../lib/logger.js";

const cmd = process.argv[2];

function listOrders() {
  const rows = db.prepare("SELECT id, status, order_number, customer_phone, total_cents, created_at FROM orders ORDER BY created_at DESC LIMIT 50").all();
  console.table(rows);
}

function clearTestOrders() {
  const result = db.exec("DELETE FROM order_lines; DELETE FROM orders;");
  logger.info("test orders cleared");
}

function help() {
  console.log("dev-tools commands:");
  console.log("  list-orders         — show last 50 orders");
  console.log("  clear-test-orders   — wipe all orders + lines (KEEPS menu)");
}

switch (cmd) {
  case "list-orders": listOrders(); break;
  case "clear-test-orders": clearTestOrders(); break;
  default: help();
}
