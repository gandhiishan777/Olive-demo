import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { sql } from "../db/index.js";
import { bus } from "../lib/events.js";
import { requireToken } from "../middleware/auth.js";
import { checkCallAllowed, ESTIMATED_COST_PER_CALL_USD } from "../lib/rate-limit.js";

export const callsRouter = new Hono();
callsRouter.use("*", requireToken);

callsRouter.post(
  "/calls/started",
  zValidator("json", z.object({
    conversation_id: z.string().min(1),
    from_number: z.string().nullable().optional(),
    started_at: z.string().optional(),
  })),
  async (c) => {
    const { conversation_id, from_number, started_at } = c.req.valid("json");
    const allow = await checkCallAllowed(from_number);
    if (!allow.allow) return c.json({ allow: false, reason: allow.reason });

    await sql`
      INSERT INTO calls (conversation_id, from_number, started_at, estimated_cost_usd)
      VALUES (${conversation_id}, ${from_number ?? null}, COALESCE(${started_at ?? null}, now()), ${ESTIMATED_COST_PER_CALL_USD})
      ON CONFLICT (conversation_id) DO UPDATE
        SET from_number = EXCLUDED.from_number,
            started_at = COALESCE(EXCLUDED.started_at, calls.started_at)
    `;

    bus.emitEvent({
      type: "call_started",
      data: { conversation_id, from_number: from_number ?? null, started_at: started_at ?? new Date().toISOString() },
    });
    return c.json({ allow: true });
  },
);

callsRouter.post(
  "/calls/ended",
  zValidator("json", z.object({
    conversation_id: z.string().min(1),
    duration_seconds: z.number().nonnegative().optional(),
    ended_reason: z.string().optional(),
  })),
  async (c) => {
    const { conversation_id, duration_seconds, ended_reason } = c.req.valid("json");
    const minutes = (duration_seconds ?? 0) / 60;
    const cost = Math.max(ESTIMATED_COST_PER_CALL_USD, minutes * 0.2);
    await sql`
      UPDATE calls
         SET ended_at = now(),
             duration_seconds = ${duration_seconds ?? null},
             ended_reason = ${ended_reason ?? null},
             estimated_cost_usd = ${cost}
       WHERE conversation_id = ${conversation_id}
    `;
    await sql`UPDATE orders SET status = 'cancelled' WHERE conversation_id = ${conversation_id} AND status = 'open'`;
    bus.emitEvent({ type: "call_ended", data: { conversation_id, ended_reason } });
    return c.json({});
  },
);

callsRouter.post(
  "/calls/transcript_chunk",
  zValidator("json", z.object({
    conversation_id: z.string().min(1),
    role: z.enum(["agent", "user"]),
    text: z.string(),
    timestamp: z.string().optional(),
  })),
  async (c) => {
    const { conversation_id, role, text, timestamp } = c.req.valid("json");
    bus.emitEvent({
      type: "transcript_chunk",
      data: { conversation_id, role, text, timestamp: timestamp ?? new Date().toISOString() },
    });
    return c.json({});
  },
);
