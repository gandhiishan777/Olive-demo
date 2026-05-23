import { createMiddleware } from "hono/factory";
import { nanoid } from "nanoid";
import { logger } from "../lib/logger.js";

/**
 * Tag every request with a short request_id and (if present) a conversation_id
 * pulled from the body. Logs `--> method path` on entry and `<-- status ms` on
 * exit. Without this, correlating an ElevenLabs tool-call failure with backend
 * logs requires fishing by timestamp.
 */
export const requestId = createMiddleware(async (c, next) => {
  const reqId = c.req.header("x-request-id") ?? nanoid(8);
  c.set("requestId", reqId);
  c.res.headers.set("x-request-id", reqId);

  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  // Don't read the body here (would consume the stream); the route handler
  // can log conversation_id once it has the parsed body.
  logger.info({ reqId, method, path }, "--> request");
  await next();
  const ms = Date.now() - start;
  logger.info({ reqId, method, path, status: c.res.status, ms }, "<-- response");
});
