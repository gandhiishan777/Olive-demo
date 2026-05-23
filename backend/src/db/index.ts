import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../lib/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveDbPath(): string {
  const url = env.DATABASE_URL;
  if (url.startsWith("file:")) {
    const rel = url.slice("file:".length);
    return path.isAbsolute(rel) ? rel : path.resolve(process.cwd(), rel);
  }
  throw new Error(`Unsupported DATABASE_URL: ${url}`);
}

const dbPath = resolveDbPath();
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const schemaPath = path.join(__dirname, "schema.sql");
const schema = fs.readFileSync(schemaPath, "utf8");
db.exec(schema);

export function nextOrderNumber(): string {
  const prefix = (env.RESTAURANT_NAME[0] ?? "P").toUpperCase();
  const row = db
    .prepare("UPDATE counters SET value = value + 1 WHERE name = 'order_number' RETURNING value")
    .get() as { value: number } | undefined;
  if (!row) throw new Error("counters table missing 'order_number' row");
  return `${prefix}-${row.value}`;
}
