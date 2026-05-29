import { z } from "zod";

// Coerce path param strings into positive ints.
export const PositiveIntParam = z.coerce.number().int().positive();

// Free-form modifiers blob — kitchen instructions only, never affects price.
// Example: { spice_level: "medium", no_onions: true }
export const Modifiers = z.record(z.string(), z.unknown());

export const OrderStatusEnum = z.enum(["open", "submitted", "completed"]);

// POST /api/orders
export const CreateOrderBody = z.object({
  customer_name: z.string().min(1).max(120).optional(),
  customer_phone: z.string().min(1).max(40).optional(),
  conversation_id: z.string().min(1).max(200).optional(),
});

// PATCH /api/orders/:id  (dashboard "Done" button)
export const PatchOrderBody = z.object({
  status: z.literal("completed"),
});

// POST /api/orders/:id/items
export const AddItemBody = z.object({
  item_id: z.number().int().positive(),
  quantity: z.number().int().positive(),
  modifiers: Modifiers.optional(),
  notes: z.string().max(500).optional(),
});

// PATCH /api/orders/:id/items/:lineId
export const PatchLineBody = z
  .object({
    quantity: z.number().int().positive().optional(),
    modifiers: Modifiers.optional(),
    notes: z.string().max(500).nullable().optional(),
  })
  .refine(
    (v) =>
      v.quantity !== undefined ||
      v.modifiers !== undefined ||
      v.notes !== undefined,
    { message: "Must provide at least one of: quantity, modifiers, notes" },
  );

// PATCH /api/items/:id  (dashboard 86 toggle / price edit)
export const PatchItemBody = z
  .object({
    in_stock: z.boolean().optional(),
    price_cents: z.number().int().min(0).optional(),
  })
  .refine((v) => v.in_stock !== undefined || v.price_cents !== undefined, {
    message: "Must provide in_stock and/or price_cents",
  });
