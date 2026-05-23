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
  // Server-side per-statement guard. 4s is plenty for our queries; anything
  // longer is a stuck call we'd rather fail than wait on.
  // Server-side per-statement guard, milliseconds. 4000 = 4s.
  connection: { statement_timeout: 4000 },
  onnotice: () => {},
  onparameter: () => {},
  transform: { undefined: null },
});

// Smoke check at startup. Wrapped in Promise.race so a slow Supabase
// can't stall boot indefinitely (matters during mid-demo restart).
export async function pingDb(timeoutMs = 5_000): Promise<boolean> {
  try {
    const result = await Promise.race([
      sql<[{ ok: number }]>`SELECT 1 AS ok`.then((rows) => rows[0]?.ok === 1),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
    ]);
    return result === true;
  } catch (err) {
    logger.error({ err: (err as Error).message }, "DB ping failed");
    return false;
  }
}

// Accepts the outer `sql` connection OR a transaction handle so it can be
// called from inside `sql.begin(async tx => ...)`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function nextOrderNumber(conn: any = sql): Promise<string> {
  const [row] = await conn`SELECT nextval('order_number_seq')::text AS n` as Array<{ n: string }>;
  const prefix = (env.RESTAURANT_NAME.trim()[0] ?? "P").toUpperCase();
  return `${prefix}-${row!.n}`;
}

// Graceful shutdown
let closing = false;
export async function closeDb(): Promise<void> {
  if (closing) return;
  closing = true;
  await sql.end({ timeout: 5 });
}
