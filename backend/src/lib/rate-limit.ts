import { db } from "../db/index.js";
import { env } from "./env.js";
import { logger } from "./logger.js";

const ESTIMATED_COST_PER_CALL_USD = 0.2;

export function callsInLastHour(fromNumber: string): number {
  if (!fromNumber) return 0;
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM calls
       WHERE from_number = ?
         AND started_at > datetime('now', '-1 hour')`,
    )
    .get(fromNumber) as { n: number };
  return row.n;
}

export function todayBudgetSpent(): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(estimated_cost_usd), 0) AS spent FROM calls
       WHERE started_at > datetime('now', '-1 day')`,
    )
    .get() as { spent: number };
  return row.spent;
}

export type AllowResult = { allow: true } | { allow: false; reason: "rate_limit" | "daily_budget" };

export function checkCallAllowed(fromNumber: string | null | undefined): AllowResult {
  if (fromNumber) {
    const n = callsInLastHour(fromNumber);
    if (n >= env.RATE_LIMIT_CALLS_PER_HOUR) {
      logger.warn({ fromNumber, n }, "rate_limit hit");
      return { allow: false, reason: "rate_limit" };
    }
  }
  const spent = todayBudgetSpent();
  if (spent + ESTIMATED_COST_PER_CALL_USD > env.DAILY_CALL_BUDGET_USD) {
    logger.error({ spent }, "daily budget exceeded");
    return { allow: false, reason: "daily_budget" };
  }
  return { allow: true };
}

export { ESTIMATED_COST_PER_CALL_USD };
