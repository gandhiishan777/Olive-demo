import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { httpError, json, withErrorHandler } from "@/lib/http";
import { PatchOrderBody, PositiveIntParam } from "@/lib/schemas";
import type { Order, OrderLine, OrderWithLines } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const ORDER_COLUMNS =
  "id, status, customer_name, customer_phone, conversation_id, total_cents, created_at, submitted_at, completed_at, pickup_eta, order_number";

async function parseOrderId(ctx: Params): Promise<
  | { ok: true; id: number }
  | { ok: false; res: ReturnType<typeof httpError> }
> {
  const { id } = await ctx.params;
  const parsed = PositiveIntParam.safeParse(id);
  if (!parsed.success) {
    return {
      ok: false,
      res: httpError(400, "INVALID_BODY", "Invalid order id"),
    };
  }
  return { ok: true, id: parsed.data };
}

// GET /api/orders/:id — full order + lines for the agent's read-back step.
export const GET = withErrorHandler(async (_req: NextRequest, ctx: Params) => {
  const parsed = await parseOrderId(ctx);
  if (!parsed.ok) return parsed.res;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("orders")
    .select(`${ORDER_COLUMNS}, order_lines(*)`)
    .eq("id", parsed.id)
    .maybeSingle();

  if (error) {
    console.error("[api/orders/:id GET] failed", error);
    return httpError(500, "INTERNAL", error.message);
  }
  if (!data) {
    return httpError(404, "ORDER_NOT_FOUND", `Order ${parsed.id} not found`);
  }

  const order = data as unknown as OrderWithLines;
  return json(200, {
    order: order as Order,
    lines: order.order_lines as OrderLine[],
    total_cents: order.total_cents,
  });
});

// PATCH /api/orders/:id — dashboard "Done" button. Only completes a submitted order.
export const PATCH = withErrorHandler(async (req: NextRequest, ctx: Params) => {
  const parsed = await parseOrderId(ctx);
  if (!parsed.ok) return parsed.res;

  const bodyJson = await req.json().catch(() => null);
  const bodyParsed = PatchOrderBody.safeParse(bodyJson);
  if (!bodyParsed.success) {
    return httpError(
      409,
      "INVALID_TRANSITION",
      "Only { status: 'completed' } is accepted on this endpoint",
      { issues: bodyParsed.error.issues },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: current, error: fetchErr } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", parsed.id)
    .maybeSingle();

  if (fetchErr) {
    return httpError(500, "INTERNAL", fetchErr.message);
  }
  if (!current) {
    return httpError(404, "ORDER_NOT_FOUND", `Order ${parsed.id} not found`);
  }
  if (current.status !== "submitted") {
    return httpError(
      409,
      "INVALID_TRANSITION",
      `Cannot complete an order in status '${current.status}'; expected 'submitted'`,
    );
  }

  const { data, error } = await supabase
    .from("orders")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", parsed.id)
    .select(ORDER_COLUMNS)
    .single();

  if (error || !data) {
    return httpError(500, "INTERNAL", error?.message ?? "update failed");
  }

  return json(200, { order: data as Order });
});
