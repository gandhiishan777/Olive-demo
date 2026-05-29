import { NextResponse } from "next/server";
import type { ApiErrorCode } from "./types";

export function json<T>(status: number, body: T): NextResponse {
  return NextResponse.json(body, { status });
}

type ErrorExtras = Record<string, unknown> | undefined;

export function httpError(
  status: number,
  code: ApiErrorCode,
  message: string,
  extras?: ErrorExtras,
): NextResponse {
  return NextResponse.json(
    { error: { code, message, ...(extras ?? {}) } },
    { status },
  );
}

/**
 * Wrap a route handler so any thrown error becomes a clean 500 INTERNAL
 * with the error logged server-side. Keeps every route's happy-path
 * code free of try/catch boilerplate.
 */
export function withErrorHandler<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
): (...args: Args) => Promise<NextResponse> {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (err) {
      console.error("[api] unhandled", err);
      return httpError(500, "INTERNAL", "Unexpected server error");
    }
  };
}
