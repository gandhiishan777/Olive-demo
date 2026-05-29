import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { httpError, json, withErrorHandler } from "@/lib/http";
import { CreateOrderBody } from "@/lib/schemas";
import type { OrderStatus, OrderWithLines } from "@/lib/types";

export const dynamic = "force-dynamic";

const ORDER_COLUMNS =
  "id, status, customer_name, customer_phone, conversation_id, total_cents, created_at, submitted_at, completed_at, pickup_eta, order_number";

const ALL_STATUSES: OrderStatus[] = ["open", "submitted", "completed"];
const DEFAULT_COMPLETED_WINDOW_MIN = 30;
const DEFAULT_LIMIT = 50;

// GET /api/orders?status=submitted,completed&since=ISO&limit=50
//
// Used by the dashboard kitchen view. Returns submitted orders unbounded plus
// recent completed orders within a sliding window so the list doesn't grow
// forever. `open` orders are intentionally excluded by default — they only
// represent an in-progress agent call and shouldn't clutter the kitchen.
export const GET = withErrorHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);

  const statusParam = searchParams.get("status");
  const statuses: OrderStatus[] = statusParam
    ? (statusParam
        .split(",")
        .map((s) => s.trim())
        .filter((s): s is OrderStatus =>
          (ALL_STATUSES as string[]).includes(s),
        ) as OrderStatus[])
    : ["submitted", "completed"];

  const since = searchParams.get("since");
  const limitRaw = searchParams.get("limit");
  const limit = Math.max(
    1,
    Math.min(200, limitRaw ? Number(limitRaw) : DEFAULT_LIMIT),
  );

  const completedSince =
    since ??
    new Date(
      Date.now() - DEFAULT_COMPLETED_WINDOW_MIN * 60_000,
    ).toISOString();

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("orders")
    .select(`${ORDER_COLUMNS}, order_lines(*)`)
    .in("status", statuses)
    .order("submitted_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  // Sliding window only applies to completed rows. Submitted rows live
  // forever in the list until staff press Done. Encode via an OR clause.
  if (statuses.includes("completed")) {
    query = query.or(
      `status.neq.completed,completed_at.gte.${completedSince}`,
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error("[api/orders GET] failed", error);
    return httpError(500, "INTERNAL", error.message);
  }

  return json(200, { orders: (data ?? []) as unknown as OrderWithLines[] });
});

// POST /api/orders — agent creates a new empty order at the start of a call.
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  const parsed = CreateOrderBody.safeParse(body ?? {});
  if (!parsed.success) {
    return httpError(400, "INVALID_BODY", "Invalid request body", {
      issues: parsed.error.issues,
    });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("orders")
    .insert({
      status: "open",
      total_cents: 0,
      customer_name: parsed.data.customer_name ?? null,
      customer_phone: parsed.data.customer_phone ?? null,
      conversation_id: parsed.data.conversation_id ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[api/orders POST] insert failed", error);
    return httpError(500, "INTERNAL", error?.message ?? "insert failed");
  }

  return json(201, { order_id: data.id });
});
