import { z } from "zod";

import { COURIER_IDS } from "@/lib/couriers";
import { OrderStatus } from "@/lib/generated/prisma/enums";
import { en } from "@/lib/i18n/en";
import { measurementShapeSchema } from "@/lib/measurements";

// Everything the admin orders screens accept from the URL and from forms, checked with Zod.
// Pure, so it is unit-tested; Server Actions and pages parse with these before doing anything.

const e = en.admin.order.errors;

// ─── Order list URL: ?status=paid&q=VRS-1001&page=2 ────────────────────────

const listSchema = z.object({
  status: z.enum(OrderStatus).optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type AdminOrderListParams = {
  status?: OrderStatus;
  q?: string;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

/** Reads the order list's search params. Never throws: anything odd falls back to a default. */
export function parseAdminOrderParams(raw: RawParams): AdminOrderListParams {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const parsed = listSchema.parse({
    status: first(raw.status),
    q: first(raw.q),
    page: first(raw.page) ?? 1,
  });
  return { status: parsed.status, q: parsed.q || undefined, page: parsed.page };
}

/** The search box matches an order number ("VRS-1001" or "1001") or part of an email. */
export function orderSearch(q: string): { number: string } | { emailContains: string } {
  const number = q.trim().match(/^(?:vrs-?)?(\d{1,9})$/i);
  if (number) return { number: `VRS-${number[1]}` };
  return { emailContains: q.trim().toLowerCase() };
}

// ─── Forms on the order page ───────────────────────────────────────────────

const optionalText = z
  .string()
  .trim()
  .max(1000, e.tooLong)
  .optional()
  .transform((value) => value || undefined);

const statusBase = {
  orderId: z.uuid(),
  /** The status the admin saw, so a stale page can't move the order twice. */
  expectedFrom: z.enum(OrderStatus),
  note: optionalText,
};

export const statusChangeSchema = z.discriminatedUnion("to", [
  z.object({ ...statusBase, to: z.literal("confirmed") }),
  z.object({ ...statusBase, to: z.literal("in_production") }),
  z.object({ ...statusBase, to: z.literal("delivered") }),
  z.object({
    ...statusBase,
    to: z.literal("shipped"),
    courier: z.enum(COURIER_IDS, { error: e.courier }),
    trackingNumber: z
      .string({ error: e.tracking })
      .trim()
      .min(4, e.tracking)
      .max(40, e.trackingFormat)
      .regex(/^[A-Za-z0-9][A-Za-z0-9 -]*$/, e.trackingFormat),
  }),
  z.object({
    ...statusBase,
    to: z.literal("cancelled"),
    // An HTML checkbox sends "on" when ticked and nothing when not.
    restock: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
  }),
]);

export type StatusChangeInput = z.infer<typeof statusChangeSchema>;

export const orderNoteSchema = z.object({
  orderId: z.uuid(),
  note: z.string({ error: e.noteEmpty }).trim().min(1, e.noteEmpty).max(1000, e.tooLong),
});

export const orderIdSchema = z.object({ orderId: z.uuid() });

/** Form data as a plain object, without files. */
export function formFields(formData: FormData): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [key, value] of formData) if (typeof value === "string") fields[key] = value;
  return fields;
}

/** The first problem, worded for the admin. */
export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  // Hidden fields (ids, statuses) only fail if the page was tampered with or is very old.
  if (!issue || ["orderId", "expectedFrom", "to"].includes(String(issue.path[0]))) {
    return e.invalid;
  }
  return issue.message;
}

/** "Edit measurements" on a custom-fit piece. The values are fully checked in lib/orders. */
export const itemMeasurementsSchema = z.object({
  orderId: z.uuid(),
  itemId: z.uuid(),
  set: measurementShapeSchema,
});
