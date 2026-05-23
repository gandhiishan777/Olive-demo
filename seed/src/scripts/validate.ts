import fs from "node:fs";
import path from "node:path";
import { MenuSchema } from "../lib/schema.js";

const file = process.argv[2];
if (!file) {
  console.error("Usage: pnpm --filter @olive/seed validate <menu.json>");
  process.exit(1);
}
const abs = path.resolve(process.cwd(), file);
const raw = JSON.parse(fs.readFileSync(abs, "utf8"));
const result = MenuSchema.safeParse(raw);
if (!result.success) {
  console.error("✗ Schema validation failed:");
  for (const issue of result.error.issues) console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}
console.log(`✓ ${result.data.items.length} items valid in ${abs}`);
