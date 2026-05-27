import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { bus } from "../lib/events.js";

export const streamRouter = new Hono();

streamRouter.get("/orders/stream", (c) => {
  return streamSSE(c, async (stream) => {
    let active = true;
    let unsubscribe: (() => void) | null = null;
    let sleepResolver: (() => void) | null = null;

    stream.onAbort(() => {
      active = false;
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
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
