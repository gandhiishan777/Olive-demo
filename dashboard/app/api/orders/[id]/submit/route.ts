import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { httpError, json, withErrorHandler } from "@/lib/http";
import { PositiveIntParam, SubmitOrderBody } from "@/lib/schemas";
import { computePickupEta } from "@/lib/eta";
import type { Order, OrderLine, OrderWithLines } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const ORDER_COLUMNS =
  "id, status, customer_name, customer_phone, conversation_id, total_cents, created_at, submitted_at, completed_at, pickup_eta, order_number";

// POST /api/orders/:id/submit — agent finalizes the order after the customer's "yes".
// Optionally accepts { customer_name } captured at the end of the call.
export const POST = withErrorHandler(async (req: NextRequest, ctx: Params) => {
  const { id: rawId } = await ctx.params;
  const idParsed = PositiveIntParam.safeParse(rawId);
  if (!idParsed.success) {
    return httpError(400, "INVALID_BODY", "Invalid order id");
  }
  const orderId = idParsed.data;

  // Body is optional — tolerate empty/missing JSON.
  const bodyJson = await req.json().catch(() => null);
  const bodyParsed = SubmitOrderBody.safeParse(bodyJson ?? {});
  if (!bodyParsed.success) {
    return httpError(400, "INVALID_BODY", "Invalid request body", {
      issues: bodyParsed.error.issues,
    });
  }

  const supabase = getSupabaseAdmin();

  // Load current order + lines for validation + ETA input
  const { data: current, error: fetchErr } = await supabase
    .from("orders")
    .select(`${ORDER_COLUMNS}, order_lines(id)`)
    .eq("id", orderId)
    .maybeSingle();

  if (fetchErr) return httpError(500, "INTERNAL", fetchErr.message);
  if (!current) {
    return httpError(404, "ORDER_NOT_FOUND", `Order ${orderId} not found`);
  }

  const currentOrder = current as unknown as Order & {
    order_lines: { id: number }[];
  };
  if (currentOrder.status !== "open") {
    return httpError(
      409,
      "INVALID_TRANSITION",
      `Cannot submit an order in status '${currentOrder.status}'`,
    );
  }
  if (!currentOrder.order_lines || currentOrder.order_lines.length === 0) {
    return httpError(409, "EMPTY_ORDER", "Cannot submit an empty order");
  }

  const submittedAt = new Date();
  const pickupEta = await computePickupEta(orderId, submittedAt);

  // Only overwrite the name when the agent actually supplied one, so an
  // empty-body submit doesn't wipe a name set at order creation.
  const update: Record<string, unknown> = {
    status: "submitted",
    submitted_at: submittedAt.toISOString(),
    pickup_eta: pickupEta,
  };
  if (bodyParsed.data.customer_name) {
    update.customer_name = bodyParsed.data.customer_name;
  }

  const { data: updated, error: updateErr } = await supabase
    .from("orders")
    .update(update)
    .eq("id", orderId)
    .select(`${ORDER_COLUMNS}, order_lines(*)`)
    .single();

  if (updateErr || !updated) {
    return httpError(500, "INTERNAL", updateErr?.message ?? "update failed");
  }

  const final = updated as unknown as OrderWithLines;
  return json(200, {
    order: final as Order,
    lines: final.order_lines as OrderLine[],
    pickup_eta: pickupEta,
  });
});
