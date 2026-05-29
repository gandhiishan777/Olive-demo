import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { httpError, json, withErrorHandler } from "@/lib/http";
import { PatchLineBody, PositiveIntParam } from "@/lib/schemas";
import { recomputeOrderTotal } from "@/lib/totals";
import { getOrderStatus } from "@/lib/orders";
import type { OrderLine } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; lineId: string }> };

async function parseIds(ctx: Params): Promise<
  | { ok: true; orderId: number; lineId: number }
  | { ok: false; res: ReturnType<typeof httpError> }
> {
  const p = await ctx.params;
  const orderParsed = PositiveIntParam.safeParse(p.id);
  const lineParsed = PositiveIntParam.safeParse(p.lineId);
  if (!orderParsed.success || !lineParsed.success) {
    return {
      ok: false,
      res: httpError(400, "INVALID_BODY", "Invalid id in path"),
    };
  }
  return { ok: true, orderId: orderParsed.data, lineId: lineParsed.data };
}

async function ensureLineBelongsToOpenOrder(
  orderId: number,
  lineId: number,
): Promise<{ ok: true } | { ok: false; res: ReturnType<typeof httpError> }> {
  const order = await getOrderStatus(orderId);
  if (!order) {
    return {
      ok: false,
      res: httpError(404, "ORDER_NOT_FOUND", `Order ${orderId} not found`),
    };
  }
  if (order.status !== "open") {
    return {
      ok: false,
      res: httpError(
        409,
        "ORDER_LOCKED",
        `Cannot modify lines on a '${order.status}' order`,
      ),
    };
  }

  const supabase = getSupabaseAdmin();
  const { data: line, error } = await supabase
    .from("order_lines")
    .select("id, order_id")
    .eq("id", lineId)
    .maybeSingle();
  if (error) {
    return { ok: false, res: httpError(500, "INTERNAL", error.message) };
  }
  if (!line || line.order_id !== orderId) {
    return {
      ok: false,
      res: httpError(404, "LINE_NOT_FOUND", `Line ${lineId} not on order ${orderId}`),
    };
  }
  return { ok: true };
}

// PATCH /api/orders/:id/items/:lineId — change quantity / notes / modifiers.
export const PATCH = withErrorHandler(async (req: NextRequest, ctx: Params) => {
  const ids = await parseIds(ctx);
  if (!ids.ok) return ids.res;

  const bodyJson = await req.json().catch(() => null);
  const parsed = PatchLineBody.safeParse(bodyJson);
  if (!parsed.success) {
    return httpError(400, "INVALID_BODY", "Invalid request body", {
      issues: parsed.error.issues,
    });
  }

  const check = await ensureLineBelongsToOpenOrder(ids.orderId, ids.lineId);
  if (!check.ok) return check.res;

  const supabase = getSupabaseAdmin();
  const { data: line, error } = await supabase
    .from("order_lines")
    .update(parsed.data)
    .eq("id", ids.lineId)
    .select("*")
    .single();

  if (error || !line) {
    return httpError(500, "INTERNAL", error?.message ?? "update failed");
  }

  const totalCents = await recomputeOrderTotal(ids.orderId);
  return json(200, {
    line: line as OrderLine,
    order_total_cents: totalCents,
  });
});

// DELETE /api/orders/:id/items/:lineId — remove a line.
export const DELETE = withErrorHandler(async (_req: NextRequest, ctx: Params) => {
  const ids = await parseIds(ctx);
  if (!ids.ok) return ids.res;

  const check = await ensureLineBelongsToOpenOrder(ids.orderId, ids.lineId);
  if (!check.ok) return check.res;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("order_lines")
    .delete()
    .eq("id", ids.lineId);

  if (error) {
    return httpError(500, "INTERNAL", error.message);
  }

  const totalCents = await recomputeOrderTotal(ids.orderId);
  return json(200, { deleted_line_id: ids.lineId, order_total_cents: totalCents });
});
