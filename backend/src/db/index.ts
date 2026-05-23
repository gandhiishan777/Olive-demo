import postgres from "postgres";
import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";

const connectionString = env.SUPABASE_DB_URL ?? "";

// postgres.js handles connection pooling for us.
// Session pooler (port 5432) supports prepared statements; transaction pooler (6543) doesn't.
// We auto-detect from the URL.
const isTransactionPooler = connectionString.includes(":6543");

export const sql = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: !isTransactionPooler,
  onnotice: () => {},
  onparameter: () => {},
  transform: {
    undefined: null, // postgres.js requires explicit null for undefined values
  },
});

// Smoke check at startup
export async function pingDb(): Promise<boolean> {
  try {
    const [row] = await sql<[{ ok: number }]>`SELECT 1 AS ok`;
    return row?.ok === 1;
  } catch (err) {
    logger.error({ err: (err as Error).message }, "DB ping failed");
    return false;
  }
}

export async function nextOrderNumber(): Promise<string> {
  const [row] = await sql<[{ n: string }]>`SELECT nextval('order_number_seq')::text AS n`;
  const prefix = (env.RESTAURANT_NAME[0] ?? "P").toUpperCase();
  return `${prefix}-${row!.n}`;
}

// Graceful shutdown
let closing = false;
export async function closeDb(): Promise<void> {
  if (closing) return;
  closing = true;
  await sql.end({ timeout: 5 });
}
