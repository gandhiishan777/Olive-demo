import { sql } from "../db/index.js";
import { env } from "./env.js";
import { logger } from "./logger.js";

const ESTIMATED_COST_PER_CALL_USD = 0.2;

export async function callsInLastHour(fromNumber: string): Promise<number> {
  if (!fromNumber) return 0;
  const [row] = await sql<[{ n: string }]>`
    SELECT COUNT(*)::text AS n FROM calls
     WHERE from_number = ${fromNumber}
       AND started_at > now() - interval '1 hour'
  `;
  return Number(row?.n ?? 0);
}

export async function todayBudgetSpent(): Promise<number> {
  const [row] = await sql<[{ spent: string }]>`
    SELECT COALESCE(SUM(estimated_cost_usd), 0)::text AS spent FROM calls
     WHERE started_at > now() - interval '1 day'
  `;
  return Number(row?.spent ?? 0);
}

export type AllowResult = { allow: true } | { allow: false; reason: "rate_limit" | "daily_budget" };

export async function checkCallAllowed(fromNumber: string | null | undefined): Promise<AllowResult> {
  if (fromNumber) {
    const n = await callsInLastHour(fromNumber);
    if (n >= env.RATE_LIMIT_CALLS_PER_HOUR) {
      logger.warn({ fromNumber, n }, "rate_limit hit");
      return { allow: false, reason: "rate_limit" };
    }
  }
  const spent = await todayBudgetSpent();
  if (spent + ESTIMATED_COST_PER_CALL_USD > env.DAILY_CALL_BUDGET_USD) {
    logger.error({ spent }, "daily budget exceeded");
    return { allow: false, reason: "daily_budget" };
  }
  return { allow: true };
}

export { ESTIMATED_COST_PER_CALL_USD };
