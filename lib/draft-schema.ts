import { z } from "zod";

import { measurementShapeSchema } from "@/lib/measurements";

// A bag line as priced by our server and saved in checkout_drafts.items while the shopper is on
// Stripe's page. The webhook reads it back (validated again) to build the order.

export const draftLineSchema = z.object({
  productId: z.uuid(),
  variantId: z.uuid().nullable(),
  productSlug: z.string().min(1),
  title: z.string().min(1),
  size: z.string().nullable(),
  isCustom: z.boolean(),
  quantity: z.number().int().min(1).max(10),
  unitPriceCents: z.number().int().positive(),
  productionDays: z.number().int().positive(),
  imageUrl: z.string().nullable(),
  /**
   * Custom-fit measurements, fully checked at checkout. Only the shape is checked here, so a
   * range changed between checkout and the webhook can never stop a paid order being saved.
   */
  measurements: measurementShapeSchema.nullable(),
});

export type DraftLine = z.infer<typeof draftLineSchema>;

export const draftLinesSchema = z.array(draftLineSchema).min(1);
