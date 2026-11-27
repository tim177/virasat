import { en } from "@/lib/i18n/en";
import { MEASUREMENT_FIELDS, measurementShapeSchema } from "@/lib/measurements";

// Measurements as people read them: "1. Bust · 36.5 in". Used by the admin order page and the
// customer's order pages. Shows exactly what was saved with the order, never converted.

export type MeasurementRow = { key: string; label: string; value: string };

export type MeasurementDisplay = {
  title: string | null;
  rows: MeasurementRow[];
  notes: string | null;
};

export function describeMeasurements(raw: unknown): MeasurementDisplay | null {
  if (raw === null || raw === undefined) return null;
  const parsed = measurementShapeSchema.safeParse(raw);
  if (!parsed.success) {
    // Anything else saved by hand: show it as it is.
    if (typeof raw !== "object" || Array.isArray(raw)) return null;
    const rows = Object.entries(raw as Record<string, unknown>).map(([key, value]) => ({
      key,
      label: key,
      value: typeof value === "object" ? JSON.stringify(value) : String(value),
    }));
    return rows.length > 0 ? { title: null, rows, notes: null } : null;
  }

  const { kind, unit, values, notes } = parsed.data;
  const strings = en.fit.fields[kind];
  const unitShort = en.fit.unitShort[unit];
  const known = MEASUREMENT_FIELDS[kind];
  // Numbered as in the form and the diagram, even if some are missing.
  const rows: MeasurementRow[] = known.flatMap((field, index) =>
    values[field.key] === undefined
      ? []
      : [
          {
            key: field.key,
            label: `${index + 1}. ${strings[field.key]?.label ?? field.key}`,
            value: `${values[field.key]} ${unitShort}`,
          },
        ],
  );
  // Measurements no longer on the list (e.g. after the tailor changes it) still show.
  for (const [key, value] of Object.entries(values)) {
    if (!known.some((field) => field.key === key)) {
      rows.push({ key, label: strings[key]?.label ?? key, value: `${value} ${unitShort}` });
    }
  }
  return { title: en.fit.kinds[kind], rows, notes: notes?.trim() ? notes.trim() : null };
}
