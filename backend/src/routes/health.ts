import { Hono } from "hono";
import { db } from "../db/index.js";

export const healthRouter = new Hono();

healthRouter.get("/healthz", (c) => {
  let dbOk = false;
  try {
    const row = db.prepare("SELECT 1 AS ok").get() as { ok: number };
    dbOk = row.ok === 1;
  } catch {
    dbOk = false;
  }
  return c.json({ ok: dbOk, db: dbOk, version: "0.1.0" }, dbOk ? 200 : 503);
});
