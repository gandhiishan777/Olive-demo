import { Hono } from "hono";
import { pingDb } from "../db/index.js";

export const healthRouter = new Hono();

healthRouter.get("/healthz", async (c) => {
  const dbOk = await pingDb();
  return c.json({ ok: dbOk, db: dbOk, version: "0.1.0" }, dbOk ? 200 : 503);
});
