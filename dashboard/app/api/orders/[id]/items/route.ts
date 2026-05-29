import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { httpError, json, withErrorHandler } from "@/lib/http";
import { AddItemBody, PositiveIntParam } from "@/lib/schemas";
import { recomputeOrderTotal } from "@/lib/totals";
import { getOrderStatus } from "@/lib/orders";
import type { OrderLine } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// POST /api/orders/:id/items — agent appends a line.
export const POST = withErrorHandler(async (req: NextRequest, ctx: Params) => {
  const { id: rawId } = await ctx.params;
  const idParsed = PositiveIntParam.safeParse(rawId);
  if (!idParsed.success) {
    return httpError(400, "INVALID_BODY", "Invalid order id");
  }
  const orderId = idParsed.data;

  const bodyJson = await req.json().catch(() => null);
  const parsed = AddItemBody.safeParse(bodyJson);
  if (!parsed.success) {
    return httpError(400, "INVALID_BODY", "Invalid request body", {
      issues: parsed.error.issues,
    });
  }

  // 1. Order must exist and be open
  const order = await getOrderStatus(orderId);
  if (!order) {
    return httpError(404, "ORDER_NOT_FOUND", `Order ${orderId} not found`);
  }
  if (order.status !== "open") {
    return httpError(
      409,
      "ORDER_LOCKED",
      `Cannot add items to an order in status '${order.status}'`,
    );
  }

  // 2. Item must exist and be in stock
  const supabase = getSupabaseAdmin();
  const { data: item, error: itemErr } = await supabase
    .from("items")
    .select("id, name, price_cents, in_stock")
    .eq("id", parsed.data.item_id)
    .maybeSingle();

  if (itemErr) {
    return httpError(500, "INTERNAL", itemErr.message);
  }
  if (!item) {
    return httpError(
      404,
      "ITEM_NOT_FOUND",
      `Item ${parsed.data.item_id} not found`,
    );
  }
  if (!item.in_stock) {
    return httpError(
      409,
      "ITEM_OUT_OF_STOCK",
      `Item '${item.name}' is currently 86'd`,
    );
  }

  // 3. Insert line with snapshots
  const { data: line, error: insertErr } = await supabase
    .from("order_lines")
    .insert({
      order_id: orderId,
      item_id: item.id,
      item_name: item.name,
      quantity: parsed.data.quantity,
      unit_price_cents: item.price_cents,
      modifiers: parsed.data.modifiers ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select("*")
    .single();

  if (insertErr || !line) {
    return httpError(500, "INTERNAL", insertErr?.message ?? "insert failed");
  }

  const totalCents = await recomputeOrderTotal(orderId);

  return json(201, {
    line: line as OrderLine,
    line_total_cents: (line as OrderLine).quantity * (line as OrderLine).unit_price_cents,
    order_total_cents: totalCents,
  });
});
