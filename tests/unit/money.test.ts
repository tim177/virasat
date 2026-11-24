import { describe, expect, it } from "vitest";

import { assertCents, formatCents, lineTotalCents } from "@/lib/money";

describe("formatCents", () => {
  it("formats whole dollars", () => {
    expect(formatCents(24900)).toBe("$249.00");
  });

  it("formats cents and thousands separators", () => {
    expect(formatCents(123456)).toBe("$1,234.56");
  });

  it("formats zero", () => {
    expect(formatCents(0)).toBe("$0.00");
  });

  it("rejects fractional cents", () => {
    expect(() => formatCents(10.5)).toThrow(RangeError);
  });
});

describe("assertCents", () => {
  it.each([Number.NaN, Number.POSITIVE_INFINITY, 0.1, 2 ** 53])("rejects %s", (value) => {
    expect(() => assertCents(value)).toThrow(RangeError);
  });

  it("accepts negative whole cents (refunds)", () => {
    expect(() => assertCents(-500)).not.toThrow();
  });
});

describe("lineTotalCents", () => {
  it("multiplies unit price by quantity", () => {
    expect(lineTotalCents(24900, 2)).toBe(49800);
  });

  it.each([0, -1, 1.5])("rejects quantity %s", (quantity) => {
    expect(() => lineTotalCents(24900, quantity)).toThrow(RangeError);
  });
});
