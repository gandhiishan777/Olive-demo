import postgres from "postgres";
import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";

const connectionString = env.SUPABASE_DB_URL ?? "";
const isTransactionPooler = connectionString.includes(":6543");

export const sql = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: !isTransactionPooler,
  onnotice: () => {},
  transform: { undefined: null },
});

export async function pingDb(): Promise<boolean> {
  try {
    const [row] = await sql<[{ ok: number }]>`SELECT 1 AS ok`;
    return row?.ok === 1;
  } catch (err) {
    logger.error({ err: (err as Error).message }, "DB ping failed");
    return false;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function nextOrderNumber(conn: any = sql): Promise<string> {
  const [row] = await conn`SELECT nextval('order_number_seq')::text AS n` as Array<{ n: string }>;
  const prefix = (env.RESTAURANT_NAME.trim()[0] ?? "P").toUpperCase();
  return `${prefix}-${row!.n}`;
}

export async function closeDb(): Promise<void> {
  await sql.end({ timeout: 5 });
}
