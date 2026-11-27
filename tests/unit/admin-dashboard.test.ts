import { describe, expect, it } from "vitest";

import { actionLabel, describeChanges, formatLogValue } from "@/lib/admin-log-view";
import { periodStarts, timeZoneOffsetMinutes } from "@/lib/report-periods";

describe("report periods (India time, weeks from Monday)", () => {
  it("knows each time zone's offset", () => {
    const winter = new Date("2026-01-15T12:00:00Z");
    const summer = new Date("2026-07-15T12:00:00Z");
    expect(timeZoneOffsetMinutes(winter, "Asia/Kolkata")).toBe(330);
    expect(timeZoneOffsetMinutes(winter, "UTC")).toBe(0);
    expect(timeZoneOffsetMinutes(winter, "America/New_York")).toBe(-300);
    expect(timeZoneOffsetMinutes(summer, "America/New_York")).toBe(-240);
  });

  it("starts today, the week and the month at midnight India time", () => {
    // 01:30 on Saturday 28 November in India.
    const now = new Date("2026-11-27T20:00:00Z");
    expect(periodStarts(now)).toEqual({
      today: new Date("2026-11-27T18:30:00Z"), // 28 Nov 00:00 IST
      week: new Date("2026-11-22T18:30:00Z"), // Monday 23 Nov 00:00 IST
      month: new Date("2026-10-31T18:30:00Z"), // 1 Nov 00:00 IST
    });
  });

  it("handles Mondays and the first of the month", () => {
    const monday = periodStarts(new Date("2026-11-23T05:00:00Z"));
    expect(monday.week).toEqual(monday.today);
    const firstOfMonth = periodStarts(new Date("2026-12-01T00:00:00Z")); // 05:30 IST, 1 Dec
    expect(firstOfMonth.month).toEqual(new Date("2026-11-30T18:30:00Z"));
    expect(firstOfMonth.today).toEqual(firstOfMonth.month);
    expect(firstOfMonth.week).toEqual(new Date("2026-11-29T18:30:00Z")); // Monday 30 Nov
  });
});

describe("admin log lines", () => {
  it("show what changed in an order", () => {
    expect(
      describeChanges(
        { status: "in_production", courier: null, trackingNumber: null },
        { status: "shipped", courier: "dhl", trackingNumber: "JD0146" },
      ),
    ).toEqual([
      { field: "status", label: "Status", before: "In production", after: "Shipped" },
      { field: "courier", label: "Courier", before: "—", after: "DHL Express" },
      { field: "trackingNumber", label: "Tracking number", before: "—", after: "JD0146" },
    ]);
  });

  it("show only what changed in a product, with money and lists made readable", () => {
    const before = {
      title: "Ruby saree",
      priceCents: 34900,
      customFitAvailable: false,
      sizes: [{ size: "S", stock: 3 }],
      photos: [{ url: "/a.webp", alt: "A" }],
    };
    const after = {
      ...before,
      priceCents: 29900,
      customFitAvailable: true,
      sizes: [
        { size: "S", stock: 0 },
        { size: "M", stock: null },
      ],
    };
    expect(describeChanges(before, after)).toEqual([
      { field: "priceCents", label: "Price", before: "$349.00", after: "$299.00" },
      { field: "customFitAvailable", label: "Custom fit", before: "No", after: "Yes" },
      { field: "sizes", label: "Sizes", before: "S: 3", after: "S: 0, M: made to order" },
    ]);
  });

  it("sum up new records and notes, and show nothing for plain actions", () => {
    expect(
      describeChanges(null, {
        title: "Ruby saree",
        priceCents: 34900,
        status: "draft",
        care: "Dry clean",
      }),
    ).toEqual([
      { field: "title", label: "Name", before: "—", after: "Ruby saree" },
      { field: "priceCents", label: "Price", before: "—", after: "$349.00" },
      { field: "status", label: "Status", before: "—", after: "Draft" },
    ]);
    expect(describeChanges(null, { note: "Call her" })).toEqual([
      { field: "note", label: "Note", before: "—", after: "Call her" },
    ]);
    expect(describeChanges(null, null)).toEqual([]);
  });

  it("format values and actions", () => {
    expect(formatLogValue("note", "x".repeat(200))).toHaveLength(118);
    expect(formatLogValue("photos", [{}, {}])).toBe("2 photos");
    expect(formatLogValue("occasions", ["wedding", "festive"])).toBe("wedding, festive");
    expect(formatLogValue("sizes", [])).toBe("—");
    expect(formatLogValue("restockedLines", 2)).toBe("2");
    expect(formatLogValue("compareAtCents", null)).toBe("—");
    expect(formatLogValue("someNewField", { a: 1 })).toBe('{"a":1}');
    expect(actionLabel("order.status")).toBe("Changed order status");
    expect(actionLabel("product.archive")).toBe("product.archive");
  });
});
