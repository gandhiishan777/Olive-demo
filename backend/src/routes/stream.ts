import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { bus } from "../lib/events.js";

export const streamRouter = new Hono();

streamRouter.get("/orders/stream", (c) => {
  return streamSSE(c, async (stream) => {
    let active = true;
    stream.onAbort(() => { active = false; });

    const unsubscribe = bus.onEvent(async (ev) => {
      if (!active) return;
      try {
        await stream.writeSSE({ event: ev.type, data: JSON.stringify(ev.data) });
      } catch {
        active = false;
      }
    });

    // Initial hello
    await stream.writeSSE({ event: "ping", data: JSON.stringify({ at: new Date().toISOString() }) });

    // Keepalive
    while (active) {
      await stream.sleep(25_000);
      if (!active) break;
      try {
        await stream.writeSSE({ event: "ping", data: JSON.stringify({ at: new Date().toISOString() }) });
      } catch {
        active = false;
      }
    }
    unsubscribe();
  });
});
