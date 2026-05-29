import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { httpError, json, withErrorHandler } from "@/lib/http";
import { PatchItemBody, PositiveIntParam } from "@/lib/schemas";
import type { Item } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandler(async (req: NextRequest, ctx: Params) => {
  const { id: rawId } = await ctx.params;
  const idParse = PositiveIntParam.safeParse(rawId);
  if (!idParse.success) {
    return httpError(400, "INVALID_BODY", "Invalid item id");
  }
  const itemId = idParse.data;

  const bodyJson = await req.json().catch(() => null);
  const parsed = PatchItemBody.safeParse(bodyJson);
  if (!parsed.success) {
    return httpError(400, "INVALID_BODY", "Invalid request body", {
      issues: parsed.error.issues,
    });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("items")
    .update(parsed.data)
    .eq("id", itemId)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[api/items/:id] update failed", error);
    return httpError(500, "INTERNAL", error.message);
  }
  if (!data) {
    return httpError(404, "ITEM_NOT_FOUND", `Item ${itemId} not found`);
  }

  return json(200, { item: data as Item });
});
