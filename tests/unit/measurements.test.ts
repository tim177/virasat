import { describe, expect, it } from "vitest";

import { DIAGRAM_KEYS } from "@/components/fit/measurement-diagram";
import { en } from "@/lib/i18n/en";
import { describeMeasurements } from "@/lib/measurement-display";
import {
  checkedMeasurements,
  convertValue,
  MEASUREMENT_FIELDS,
  MEASUREMENT_KINDS,
  measurementSetSchema,
  parseMeasurement,
  rangeFor,
  validateMeasurements,
  type MeasurementKind,
} from "@/lib/measurements";

/** A middle-of-the-range value for every measurement of a kind, as typed text. */
function typical(kind: MeasurementKind): Record<string, string> {
  return Object.fromEntries(
    MEASUREMENT_FIELDS[kind].map((f) => [f.key, String(Math.round((f.min + f.max) / 2))]),
  );
}

const field = (kind: MeasurementKind, key: string) => {
  const found = MEASUREMENT_FIELDS[kind].find((f) => f.key === key);
  if (!found) throw new Error(`no field ${key}`);
  return found;
};

describe("the measurement lists", () => {
  it.each(MEASUREMENT_KINDS)(
    "%s: every measurement has a label, help, a diagram line and a sane range",
    (kind) => {
      const keys = MEASUREMENT_FIELDS[kind].map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const f of MEASUREMENT_FIELDS[kind]) {
        expect(en.fit.fields[kind][f.key]?.label, f.key).toBeTruthy();
        expect(en.fit.fields[kind][f.key]?.help, f.key).toBeTruthy();
        expect(DIAGRAM_KEYS, f.key).toContain(f.key);
        expect(f.min, f.key).toBeGreaterThan(0);
        expect(f.max, f.key).toBeGreaterThan(f.min);
      }
    },
  );

  it("derives centimetre ranges from the inch ranges", () => {
    expect(rangeFor(field("women", "bust"), "in")).toEqual({ min: 28, max: 60 });
    expect(rangeFor(field("women", "bust"), "cm")).toEqual({ min: 71, max: 152 });
  });
});

describe("reading one measurement", () => {
  const bust = field("women", "bust");

  it("accepts numbers with up to two decimals inside the range, ends included", () => {
    expect(parseMeasurement(bust, "in", "36")).toEqual({ value: 36 });
    expect(parseMeasurement(bust, "in", " 36.25 ")).toEqual({ value: 36.25 });
    expect(parseMeasurement(bust, "in", "28")).toEqual({ value: 28 });
    expect(parseMeasurement(bust, "in", "60")).toEqual({ value: 60 });
    expect(parseMeasurement(bust, "cm", "91.5")).toEqual({ value: 91.5 });
  });

  it("explains what's wrong", () => {
    expect(parseMeasurement(bust, "in", "")).toEqual({ error: "required" });
    expect(parseMeasurement(bust, "in", "   ")).toEqual({ error: "required" });
    for (const text of ["abc", "36 in", "-36", "36.125", "1e2", "36,5", "3600"]) {
      expect(parseMeasurement(bust, "in", text), text).toEqual({ error: "number" });
    }
    expect(parseMeasurement(bust, "in", "27.99")).toEqual({ error: "range" });
    expect(parseMeasurement(bust, "in", "60.01")).toEqual({ error: "range" });
    // 36 is a fine bust in inches, but far too small in centimetres.
    expect(parseMeasurement(bust, "cm", "36")).toEqual({ error: "range" });
  });
});

describe("switching units", () => {
  it("converts to centimetres to 0.1 and back to the nearest quarter inch", () => {
    expect(convertValue(36, "in", "cm")).toBe(91.4);
    expect(convertValue(91.4, "cm", "in")).toBe(36);
    expect(convertValue(64, "in", "cm")).toBe(162.6);
    expect(convertValue(100, "cm", "in")).toBe(39.25);
    expect(convertValue(36, "in", "in")).toBe(36);
  });

  it("keeps typical values in range after converting either way", () => {
    for (const kind of MEASUREMENT_KINDS) {
      const texts = typical(kind);
      const cm = Object.fromEntries(
        Object.entries(texts).map(([k, v]) => [k, String(convertValue(Number(v), "in", "cm"))]),
      );
      expect(validateMeasurements(kind, "cm", cm).ok, kind).toBe(true);
    }
  });
});

describe("checking a whole form", () => {
  it("returns the set with numbers, trimmed notes, and no empty notes", () => {
    const result = validateMeasurements("men", "in", typical("men"), "  I'll wear a vest  ");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.set).toMatchObject({ kind: "men", unit: "in", notes: "I'll wear a vest" });
    expect(Object.keys(result.set.values)).toEqual(MEASUREMENT_FIELDS.men.map((f) => f.key));
    expect(typeof result.set.values.chest).toBe("number");

    const noNotes = validateMeasurements("men", "in", typical("men"), "   ");
    expect(noNotes.ok && "notes" in noNotes.set).toBe(false);
  });

  it("lists an error for each problem", () => {
    const result = validateMeasurements(
      "women",
      "in",
      { ...typical("women"), bust: "", waist: "ten", hip: "99" },
      "x".repeat(501),
    );
    expect(result).toEqual({
      ok: false,
      errors: { bust: "required", waist: "number", hip: "range", notes: "notes" },
    });
  });
});

describe("measurementSetSchema (server checks)", () => {
  const valid = () => {
    const result = validateMeasurements("women", "cm", {
      ...Object.fromEntries(
        Object.entries(typical("women")).map(([k, v]) => [
          k,
          String(convertValue(Number(v), "in", "cm")),
        ]),
      ),
    });
    if (!result.ok) throw new Error("fixture should be valid");
    return result.set;
  };

  it("accepts a complete set and returns it unchanged", () => {
    const set = valid();
    expect(measurementSetSchema.parse(set)).toEqual(set);
    expect(checkedMeasurements(set)).toEqual(set);
  });

  it.each([
    [
      "a missing measurement",
      (s: ReturnType<typeof valid>) => {
        const values = Object.fromEntries(Object.entries(s.values).filter(([k]) => k !== "bust"));
        return { ...s, values };
      },
    ],
    [
      "an unknown measurement",
      (s: ReturnType<typeof valid>) => ({ ...s, values: { ...s.values, inseam: 80 } }),
    ],
    [
      "a value out of range",
      (s: ReturnType<typeof valid>) => ({ ...s, values: { ...s.values, bust: 20 } }),
    ],
    [
      "too many decimals",
      (s: ReturnType<typeof valid>) => ({ ...s, values: { ...s.values, bust: 91.123 } }),
    ],
    ["the other kind's list", (s: ReturnType<typeof valid>) => ({ ...s, kind: "men" })],
    ["an unknown unit", (s: ReturnType<typeof valid>) => ({ ...s, unit: "mm" })],
    [
      "text instead of numbers",
      (s: ReturnType<typeof valid>) => ({ ...s, values: { ...s.values, bust: "92" } }),
    ],
    [
      "notes that are too long",
      (s: ReturnType<typeof valid>) => ({ ...s, notes: "x".repeat(501) }),
    ],
  ])("rejects %s", (_name, change) => {
    expect(measurementSetSchema.safeParse(change(valid())).success).toBe(false);
  });

  it("treats anything missing as no measurements", () => {
    expect(checkedMeasurements(null)).toBeNull();
    expect(checkedMeasurements(undefined)).toBeNull();
    expect(checkedMeasurements("36")).toBeNull();
  });
});

describe("showing measurements (admin and order pages)", () => {
  it("labels and numbers them in form order, with the unit as saved", () => {
    const display = describeMeasurements({
      kind: "men",
      unit: "cm",
      values: { waist: 81.5, chest: 96 },
      notes: "Loose fit please",
    });
    expect(display).toEqual({
      title: "Men's measurements",
      rows: [
        { key: "chest", label: "1. Chest", value: "96 cm" },
        { key: "waist", label: "5. Waist", value: "81.5 cm" },
      ],
      notes: "Loose fit please",
    });
  });

  it("still shows measurements saved in another format", () => {
    expect(describeMeasurements({ bust: 36, note: "hand-entered" })).toEqual({
      title: null,
      rows: [
        { key: "bust", label: "bust", value: "36" },
        { key: "note", label: "note", value: "hand-entered" },
      ],
      notes: null,
    });
    expect(describeMeasurements(null)).toBeNull();
    expect(describeMeasurements({})).toBeNull();
  });
});
