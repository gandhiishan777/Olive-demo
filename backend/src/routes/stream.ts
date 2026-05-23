import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { timingSafeEqual } from "node:crypto";
import { bus } from "../lib/events.js";
import { env } from "../lib/env.js";

export const streamRouter = new Hono();

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

streamRouter.get("/orders/stream", (c) => {
  // EventSource (browser) cannot set custom headers — accept the token via
  // the `token` query string OR an X-Olive-Token header (for curl / Node
  // smoke tests). This is the same secret that guards write endpoints.
  // The dashboard reads the token from localStorage and appends ?token=.
  if (env.OLIVE_AGENT_TOKEN) {
    const presented = c.req.query("token") ?? c.req.header("x-olive-token") ?? "";
    if (!presented || !safeEq(presented, env.OLIVE_AGENT_TOKEN)) {
      return c.json({ error: { code: "unauthorized", message: "Invalid or missing token" } }, 401);
    }
  }

  return streamSSE(c, async (stream) => {
    let active = true;
    let unsubscribe: (() => void) | null = null;
    let sleepResolver: (() => void) | null = null;

    stream.onAbort(() => {
      active = false;
      // Tear down the bus listener immediately — don't wait for the keepalive
      // sleep to finish (was the leak path).
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      // Break any pending keepalive sleep so the handler exits promptly.
      if (sleepResolver) sleepResolver();
    });

    unsubscribe = bus.onEvent(async (ev) => {
      if (!active) return;
      try {
        await stream.writeSSE({ event: ev.type, data: JSON.stringify(ev.data) });
      } catch {
        active = false;
      }
    });

    await stream.writeSSE({ event: "ping", data: JSON.stringify({ at: new Date().toISOString() }) });

    while (active) {
      // Cancellable sleep so onAbort doesn't have to wait up to 25s.
      await new Promise<void>((resolve) => {
        sleepResolver = resolve;
        setTimeout(resolve, 25_000);
      });
      sleepResolver = null;
      if (!active) break;
      try {
        await stream.writeSSE({ event: "ping", data: JSON.stringify({ at: new Date().toISOString() }) });
      } catch {
        active = false;
      }
    }
    if (unsubscribe) unsubscribe();
  });
});
