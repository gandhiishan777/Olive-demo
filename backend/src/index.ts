import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./lib/env.js";
import { logger } from "./lib/logger.js";
import { pingDb, closeDb } from "./db/index.js";
import { healthRouter } from "./routes/health.js";
import { menuRouter } from "./routes/menu.js";
import { ordersRouter } from "./routes/orders.js";
import { streamRouter } from "./routes/stream.js";

const app = new Hono();

app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type"],
}));

app.onError((err, c) => {
  logger.error({ err: err.message, stack: err.stack }, "unhandled error");
  return c.json({ error: { code: "internal", message: "internal server error" } }, 500);
});

app.notFound((c) => c.json({ error: { code: "not_found", message: "no such route" } }, 404));

app.route("/", healthRouter);
app.route("/", menuRouter);
app.route("/", ordersRouter);
app.route("/", streamRouter);

async function start() {
  const dbOk = await pingDb();
  if (!dbOk) {
    logger.error("Could not connect to Supabase Postgres. Check SUPABASE_DB_URL.");
    process.exit(1);
  }
  serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    logger.info({ port: info.port }, "Olive backend listening");
    logger.info(`→ http://localhost:${info.port}/healthz`);
  });
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    logger.info({ sig }, "shutting down");
    await closeDb();
    process.exit(0);
  });
}

if (process.env.NODE_ENV !== "test") {
  start();
}

export { app };
