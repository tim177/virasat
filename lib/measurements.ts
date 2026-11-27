import { z } from "zod";

// Custom-fit measurements: which ones we ask for, the allowed ranges, and the checks used by the
// form (browser), the bag quote and checkout (server) and fit profiles. One place, unit-tested.
//
// PROVISIONAL: a sensible list until the tailor sends theirs (v1 spec, Step 0). The tailor must
// confirm the measurements, ranges and how-to-measure notes before launch.
// Ranges are in inches; centimetre ranges are derived from them.

export const MEASUREMENT_KINDS = ["women", "men"] as const;
export type MeasurementKind = (typeof MEASUREMENT_KINDS)[number];

export const MEASUREMENT_UNITS = ["in", "cm"] as const;
export type MeasurementUnit = (typeof MEASUREMENT_UNITS)[number];

export type MeasurementSection = "upper" | "lower" | "lengths";

export type MeasurementField = {
  key: string;
  section: MeasurementSection;
  /** Allowed range in inches. */
  min: number;
  max: number;
};

const women: MeasurementField[] = [
  { key: "bust", section: "upper", min: 28, max: 60 },
  { key: "underBust", section: "upper", min: 24, max: 54 },
  { key: "shoulder", section: "upper", min: 12, max: 20 },
  { key: "armhole", section: "upper", min: 12, max: 24 },
  { key: "upperArm", section: "upper", min: 8, max: 22 },
  { key: "waist", section: "lower", min: 22, max: 56 },
  { key: "hip", section: "lower", min: 30, max: 64 },
  { key: "shoulderToWaist", section: "lengths", min: 12, max: 22 },
  { key: "sleeveLength", section: "lengths", min: 4, max: 26 },
  { key: "waistToFloor", section: "lengths", min: 34, max: 48 },
  { key: "height", section: "lengths", min: 54, max: 78 },
];

const men: MeasurementField[] = [
  { key: "chest", section: "upper", min: 30, max: 60 },
  { key: "shoulder", section: "upper", min: 14, max: 24 },
  { key: "neck", section: "upper", min: 12, max: 22 },
  { key: "upperArm", section: "upper", min: 9, max: 20 },
  { key: "waist", section: "lower", min: 24, max: 56 },
  { key: "seat", section: "lower", min: 30, max: 60 },
  { key: "sleeveLength", section: "lengths", min: 20, max: 30 },
  { key: "kurtaLength", section: "lengths", min: 26, max: 50 },
  { key: "trouserLength", section: "lengths", min: 34, max: 46 },
  { key: "height", section: "lengths", min: 58, max: 80 },
];

export const MEASUREMENT_FIELDS: Record<MeasurementKind, readonly MeasurementField[]> = {
  women,
  men,
};

export const MEASUREMENT_SECTIONS: readonly MeasurementSection[] = ["upper", "lower", "lengths"];

const CM_PER_INCH = 2.54;
export const MAX_NOTES_LENGTH = 500;

/** The allowed range in the chosen unit (centimetres rounded to whole numbers). */
export function rangeFor(field: MeasurementField, unit: MeasurementUnit) {
  if (unit === "in") return { min: field.min, max: field.max };
  return { min: Math.round(field.min * CM_PER_INCH), max: Math.round(field.max * CM_PER_INCH) };
}

/** A value converted to the other unit: centimetres to 0.1, inches to the nearest quarter. */
export function convertValue(value: number, from: MeasurementUnit, to: MeasurementUnit): number {
  if (from === to) return value;
  if (to === "cm") return Math.round(value * CM_PER_INCH * 10) / 10;
  return Math.round((value / CM_PER_INCH) * 4) / 4;
}

export type MeasurementError = "required" | "number" | "range";

const NUMBER_TEXT = /^\d{1,3}(\.\d{1,2})?$/;

/** Reads one typed value: a number with up to two decimals, inside the field's range. */
export function parseMeasurement(
  field: MeasurementField,
  unit: MeasurementUnit,
  text: string,
): { value: number } | { error: MeasurementError } {
  const trimmed = text.trim();
  if (trimmed === "") return { error: "required" };
  if (!NUMBER_TEXT.test(trimmed)) return { error: "number" };
  const value = Number(trimmed);
  const { min, max } = rangeFor(field, unit);
  if (value < min || value > max) return { error: "range" };
  return { value };
}

/** A complete, checked set of measurements, as saved with a bag line, an order or a profile. */
export type MeasurementSet = {
  kind: MeasurementKind;
  unit: MeasurementUnit;
  values: Record<string, number>;
  notes?: string;
};

/**
 * Checks typed values for one kind and unit. Returns the set, or an error per field. Used by the
 * form as the shopper types and, through measurementSetSchema, by the server.
 */
export function validateMeasurements(
  kind: MeasurementKind,
  unit: MeasurementUnit,
  texts: Record<string, string>,
  notes = "",
):
  | { ok: true; set: MeasurementSet }
  | { ok: false; errors: Record<string, MeasurementError | "notes"> } {
  const errors: Record<string, MeasurementError | "notes"> = {};
  const values: Record<string, number> = {};
  for (const field of MEASUREMENT_FIELDS[kind]) {
    const result = parseMeasurement(field, unit, texts[field.key] ?? "");
    if ("error" in result) errors[field.key] = result.error;
    else values[field.key] = result.value;
  }
  const trimmedNotes = notes.trim();
  if (trimmedNotes.length > MAX_NOTES_LENGTH) errors.notes = "notes";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    set: { kind, unit, values, ...(trimmedNotes ? { notes: trimmedNotes } : {}) },
  };
}

/** The values as the text the form shows. */
export function valuesToTexts(values: Record<string, number>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)]));
}

/**
 * Shape only (kind, unit, numbers, notes): what the browser stores in the bag. Ranges are
 * checked separately on the server, so a bag saved before a range changed isn't thrown away.
 */
export const measurementShapeSchema = z.object({
  kind: z.enum(MEASUREMENT_KINDS),
  unit: z.enum(MEASUREMENT_UNITS),
  values: z
    .record(z.string().max(40), z.number().finite())
    .refine((v) => Object.keys(v).length <= 20),
  notes: z
    .string()
    .max(MAX_NOTES_LENGTH * 2)
    .optional(),
});

/** A complete set that passes every check: exactly the kind's measurements, all in range. */
export const measurementSetSchema = measurementShapeSchema.transform((shape, ctx) => {
  const fields = MEASUREMENT_FIELDS[shape.kind];
  const extra = Object.keys(shape.values).filter((key) => !fields.some((f) => f.key === key));
  if (extra.length > 0) {
    ctx.addIssue({ code: "custom", path: ["values"], message: `Unknown measurements: ${extra}` });
    return z.NEVER;
  }
  const texts = Object.fromEntries(
    fields.map((field) => [field.key, shape.values[field.key]?.toString() ?? ""]),
  );
  const result = validateMeasurements(shape.kind, shape.unit, texts, shape.notes ?? "");
  if (!result.ok) {
    for (const [key, error] of Object.entries(result.errors)) {
      ctx.addIssue({
        code: "custom",
        path: key === "notes" ? ["notes"] : ["values", key],
        message: error,
      });
    }
    return z.NEVER;
  }
  return result.set;
});

/** Checks a stored set (from the bag or a profile). Null when it's missing or no longer valid. */
export function checkedMeasurements(raw: unknown): MeasurementSet | null {
  const parsed = measurementSetSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
