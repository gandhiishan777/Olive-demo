import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { env } from "./lib/env.js";
import { logger } from "./lib/logger.js";
import { healthRouter } from "./routes/health.js";
import { menuRouter } from "./routes/menu.js";
import { ordersRouter } from "./routes/orders.js";
import { callsRouter } from "./routes/calls.js";
import { streamRouter } from "./routes/stream.js";

const app = new Hono();

app.use("*", cors({
  origin: (origin) => origin ?? "*",
  allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "X-Olive-Token", "Idempotency-Key"],
  credentials: false,
}));

app.use("*", honoLogger((msg) => logger.debug(msg)));

app.onError((err, c) => {
  logger.error({ err: err.message, stack: err.stack }, "unhandled error");
  return c.json({ error: { code: "internal", message: "internal server error" } }, 500);
});

app.notFound((c) => c.json({ error: { code: "not_found", message: "no such route" } }, 404));

app.route("/", healthRouter);
app.route("/", menuRouter);
app.route("/", ordersRouter);
app.route("/", callsRouter);
app.route("/", streamRouter);

const port = env.PORT;
serve({ fetch: app.fetch, port }, (info) => {
  logger.info({ port: info.port, env: env.NODE_ENV }, "Olive backend listening");
  logger.info(`→ http://localhost:${info.port}/healthz`);
});

export { app };
