import { z } from "zod";

export const SpiceLevel = z.enum(["mild", "medium", "hot", "extra_hot"]);

export const CategoryEnum = z.enum(["biryani", "curry", "appetizer", "bread", "dessert", "drink", "side"]);

export const ItemSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(1),
  description: z.string().default(""),
  price_cents: z.number().int().nonnegative(),
  in_stock: z.boolean().default(true),
  allergens: z.array(z.string()).default([]),
  spice_levels: z.array(SpiceLevel).default([]),
  prep_minutes: z.number().int().nonnegative().default(15),
  category: z.string().default("side"),
  ingredients: z.array(z.string()).default([]),
  is_vegetarian: z.boolean().default(false),
  is_vegan: z.boolean().default(false),
  is_gluten_free: z.boolean().default(false),
});

export const MenuSchema = z.object({
  restaurant: z.string().default("Paradise Biryani"),
  currency: z.string().default("USD"),
  generated_at: z.string().optional(),
  items: z.array(ItemSchema),
});

export type Item = z.infer<typeof ItemSchema>;
export type Menu = z.infer<typeof MenuSchema>;
