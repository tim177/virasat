import { z } from "zod";

import { Gender, Occasion, ProductCategory, ProductStatus } from "@/lib/generated/prisma/enums";
import { en } from "@/lib/i18n/en";
import { parseDollars } from "@/lib/money";

// The admin product form, checked with Zod (CLAUDE.md rule 8). Pure, so it is unit-tested.
// The same limits as the database rules in prisma/migrations (prices, slug, stock, alt text).

const e = en.admin.product.errors;

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** "Ruby Banarasi Silk Saree!" → "ruby-banarasi-silk-saree" */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}

const text = (min: number, max: number, message: string = e.required) =>
  z.string({ error: message }).trim().min(min, message).max(max, e.tooLong);

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const money = (message: string) =>
  z.string({ error: message }).transform((value, ctx) => {
    const cents = parseDollars(value);
    if (cents === null) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return cents;
  });

const optionalMoney = (message: string) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value?.trim()) return null;
      const cents = parseDollars(value);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return cents;
    });

const days = z.coerce.number({ error: e.days }).int(e.days).min(1, e.days).max(180, e.days);

const checkbox = z.preprocess((value) => value === "on" || value === "true", z.boolean());

/** JSON from a hidden input, parsed before the schema checks it. */
function json<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }, schema);
}

export const sizeRowSchema = z.object({
  /** Set for sizes that already exist (so stock and order links are kept). */
  id: z.uuid().optional(),
  size: z.string().trim().min(1).max(40),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .max(40)
    .regex(/^[A-Z0-9-]*$/)
    .optional()
    .transform((value) => value || undefined),
  /** null = made to order. */
  stock: z.number().int().min(0).max(100_000).nullable(),
});

export const photoSchema = z.object({
  url: z
    .string()
    .trim()
    .max(500)
    .regex(/^(\/(seed|uploads)\/[A-Za-z0-9/_.-]+|https:\/\/[^\s"'<>]+)$/),
  alt: z.string().trim().min(3).max(200),
});

export const productFormSchema = z
  .object({
    id: z.uuid().optional(),
    title: text(3, 120, e.title),
    slug: z
      .string({ error: e.slug })
      .trim()
      .toLowerCase()
      .max(80, e.slug)
      .regex(SLUG_PATTERN, e.slug),
    description: text(20, 4000, e.description),
    category: z.enum(ProductCategory, { error: e.required }),
    gender: z.enum(Gender, { error: e.required }),
    fabric: text(2, 60),
    work: text(2, 60),
    colour: text(2, 40),
    occasions: z.array(z.enum(Occasion)).max(Object.keys(Occasion).length),
    care: text(5, 1000),
    hsCode: optionalText.pipe(
      z
        .string()
        .regex(/^\d{4}(\.?\d{2}){0,3}$/, e.hsCode)
        .optional(),
    ),
    price: money(e.price).pipe(z.number().int().min(1, e.price).max(10_000_000, e.price)),
    compareAt: optionalMoney(e.price),
    readyDays: days,
    customFitAvailable: checkbox,
    customFitExtra: optionalMoney(e.price),
    customDays: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      days.optional(),
    ),
    status: z.enum(ProductStatus, { error: e.required }),
    sizes: json(z.array(sizeRowSchema).max(20)),
    photos: json(z.array(photoSchema).max(12)),
  })
  .superRefine((value, ctx) => {
    if (value.compareAt !== null && value.compareAt <= value.price) {
      ctx.addIssue({ code: "custom", path: ["compareAt"], message: e.compareAt });
    }
    if (value.customFitAvailable && value.customDays === undefined) {
      ctx.addIssue({ code: "custom", path: ["customDays"], message: e.customDays });
    }
    const names = value.sizes.map((row) => row.size.toLowerCase());
    if (new Set(names).size !== names.length) {
      ctx.addIssue({ code: "custom", path: ["sizes"], message: e.duplicateSize });
    }
    const skus = value.sizes.flatMap((row) => (row.sku ? [row.sku] : []));
    if (new Set(skus).size !== skus.length) {
      ctx.addIssue({ code: "custom", path: ["sizes"], message: e.skuTaken });
    }
    if (value.status === "published") {
      if (value.photos.length === 0) {
        ctx.addIssue({ code: "custom", path: ["photos"], message: e.publishNeedsPhoto });
      }
      if (value.sizes.length === 0 && !value.customFitAvailable) {
        ctx.addIssue({ code: "custom", path: ["sizes"], message: e.publishNeedsSize });
      }
      if (!value.hsCode) {
        ctx.addIssue({ code: "custom", path: ["hsCode"], message: e.publishNeedsHsCode });
      }
    }
  });

export type ProductFormInput = z.output<typeof productFormSchema>;

/** Field name → first message, for showing errors next to each field. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (errors[field]) continue;
    // Sizes and photos come from our own widgets, so explain the whole list.
    if (field === "sizes" && issue.code !== "custom") errors[field] = e.sizes;
    else if (field === "photos" && issue.code !== "custom") errors[field] = e.photos;
    else errors[field] = issue.message;
  }
  return errors;
}

/** The form's fields as a plain object; occasions are a list (one checkbox each). */
export function productFormFields(formData: FormData): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of formData) {
    if (typeof value === "string" && key !== "occasions") fields[key] = value;
  }
  fields.occasions = formData.getAll("occasions").filter((v) => typeof v === "string");
  if (fields.id === "") delete fields.id;
  return fields;
}
