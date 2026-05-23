import { createMiddleware } from "hono/factory";
import { timingSafeEqual } from "node:crypto";
import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export const requireToken = createMiddleware(async (c, next) => {
  // If no token configured (dev mode without one), allow but log.
  if (!env.OLIVE_AGENT_TOKEN) {
    if (env.NODE_ENV === "production") {
      return c.json({ error: { code: "auth_disabled", message: "Server not configured" } }, 500);
    }
    logger.warn("OLIVE_AGENT_TOKEN unset — write endpoint accessed without auth (dev mode only)");
    await next();
    return;
  }
  const presented = c.req.header("x-olive-token") ?? "";
  if (!presented || !safeEq(presented, env.OLIVE_AGENT_TOKEN)) {
    return c.json({ error: { code: "unauthorized", message: "Invalid or missing X-Olive-Token" } }, 401);
  }
  await next();
});
