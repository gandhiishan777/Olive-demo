import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { db } from "../db/index.js";
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
  (c) => {
    const { conversation_id, from_number, started_at } = c.req.valid("json");
    const allow = checkCallAllowed(from_number);
    if (!allow.allow) {
      return c.json({ allow: false, reason: allow.reason });
    }
    db.prepare(
      `INSERT OR REPLACE INTO calls (conversation_id, from_number, started_at, estimated_cost_usd)
       VALUES (?, ?, COALESCE(?, datetime('now')), ?)`,
    ).run(conversation_id, from_number ?? null, started_at ?? null, ESTIMATED_COST_PER_CALL_USD);
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
  (c) => {
    const { conversation_id, duration_seconds, ended_reason } = c.req.valid("json");
    // Calculate per-minute cost. Rough: $0.20/min ElevenLabs convai bundled.
    const minutes = (duration_seconds ?? 0) / 60;
    const cost = Math.max(ESTIMATED_COST_PER_CALL_USD, minutes * 0.2);
    db.prepare(
      `UPDATE calls SET ended_at = datetime('now'), duration_seconds = ?, ended_reason = ?, estimated_cost_usd = ?
       WHERE conversation_id = ?`,
    ).run(duration_seconds ?? null, ended_reason ?? null, cost, conversation_id);

    // Auto-cancel any open order still attached to this conversation
    db.prepare(
      `UPDATE orders SET status = 'cancelled'
       WHERE conversation_id = ? AND status = 'open'`,
    ).run(conversation_id);

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
  (c) => {
    const { conversation_id, role, text, timestamp } = c.req.valid("json");
    bus.emitEvent({
      type: "transcript_chunk",
      data: { conversation_id, role, text, timestamp: timestamp ?? new Date().toISOString() },
    });
    return c.json({});
  },
);
