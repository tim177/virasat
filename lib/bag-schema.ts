import { z } from "zod";

import { measurementShapeSchema } from "@/lib/measurements";

// The shopping bag as stored in the browser and sent to our API. It holds only references
// (which product, which size, how many), never prices: prices always come from our database.

export const MAX_BAG_LINES = 20;
export const MAX_QUANTITY = 5;

export const bagLineSchema = z
  .object({
    /** Stable id for this line in the bag (random for custom-fit lines). */
    id: z.string().min(1).max(64),
    productSlug: z
      .string()
      .max(120)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    /** The chosen size, or null for a custom-fit line. */
    variantId: z.uuid().nullable(),
    custom: z.boolean(),
    quantity: z.number().int().min(1).max(MAX_QUANTITY),
    /** Custom fit only. Checked in full by the server (lib/pricing.ts) on every quote. */
    measurements: measurementShapeSchema.nullable().optional(),
  })
  .refine((line) => (line.custom ? line.variantId === null : line.variantId !== null), {
    message: "A line is either a size or custom fit",
  })
  .refine((line) => line.custom || !line.measurements, {
    message: "Only custom-fit lines have measurements",
  });

export type BagLine = z.infer<typeof bagLineSchema>;

export const bagSchema = z.array(bagLineSchema).max(MAX_BAG_LINES);

/** Request body for /api/bag/quote and /api/checkout. */
export const bagRequestSchema = z.object({ lines: bagSchema.min(1) });
