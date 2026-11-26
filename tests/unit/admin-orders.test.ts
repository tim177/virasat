import { describe, expect, it } from "vitest";

import {
  firstIssue,
  formFields,
  orderNoteSchema,
  orderSearch,
  parseAdminOrderParams,
  statusChangeSchema,
} from "@/lib/admin-orders-input";
import { courierName, trackingUrl } from "@/lib/couriers";
import { en } from "@/lib/i18n/en";
import { adminNextStatuses, sendsStatusEmail } from "@/lib/order-status";

const ORDER_ID = "0190a0b0-0000-7000-8000-0000000000aa";
const e = en.admin.order.errors;

describe("order list URL", () => {
  it("reads status, search and page", () => {
    expect(parseAdminOrderParams({ status: "shipped", q: "  priya ", page: "3" })).toEqual({
      status: "shipped",
      q: "priya",
      page: 3,
    });
  });

  it("falls back to defaults instead of failing", () => {
    expect(parseAdminOrderParams({})).toEqual({ status: undefined, q: undefined, page: 1 });
    expect(parseAdminOrderParams({ status: "lost", q: "   ", page: "abc" })).toEqual({
      status: undefined,
      q: undefined,
      page: 1,
    });
    expect(parseAdminOrderParams({ page: "0" }).page).toBe(1);
    expect(parseAdminOrderParams({ page: "2.5" }).page).toBe(1);
    expect(parseAdminOrderParams({ q: "x".repeat(101) }).q).toBeUndefined();
    expect(parseAdminOrderParams({ status: ["paid", "shipped"], page: ["2", "9"] })).toEqual({
      status: "paid",
      q: undefined,
      page: 2,
    });
  });
});

describe("order search", () => {
  it.each(["VRS-1001", "vrs-1001", "VRS1001", " 1001 "])("treats %j as an order number", (q) => {
    expect(orderSearch(q)).toEqual({ number: "VRS-1001" });
  });

  it("treats anything else as part of an email", () => {
    expect(orderSearch("Priya@Example")).toEqual({ emailContains: "priya@example" });
    expect(orderSearch("VRS-abc")).toEqual({ emailContains: "vrs-abc" });
  });
});

describe("status change form", () => {
  const base = { orderId: ORDER_ID, expectedFrom: "in_production" };

  it("accepts simple moves, with an optional note", () => {
    expect(statusChangeSchema.parse({ ...base, to: "delivered", note: "  " })).toEqual({
      ...base,
      to: "delivered",
      note: undefined,
    });
    expect(statusChangeSchema.parse({ ...base, to: "confirmed", note: " Checked " }).note).toBe(
      "Checked",
    );
  });

  it("needs a known courier and a tracking number to ship", () => {
    expect(
      statusChangeSchema.parse({
        ...base,
        to: "shipped",
        courier: "dhl",
        trackingNumber: " JD0146 ",
      }),
    ).toMatchObject({ to: "shipped", courier: "dhl", trackingNumber: "JD0146" });

    const noCourier = statusChangeSchema.safeParse({
      ...base,
      to: "shipped",
      trackingNumber: "JD0146",
    });
    expect(noCourier.success || firstIssue(noCourier.error)).toBe(e.courier);
    const badCourier = statusChangeSchema.safeParse({
      ...base,
      to: "shipped",
      courier: "pigeon",
      trackingNumber: "JD0146",
    });
    expect(badCourier.success || firstIssue(badCourier.error)).toBe(e.courier);
    const noTracking = statusChangeSchema.safeParse({ ...base, to: "shipped", courier: "ups" });
    expect(noTracking.success || firstIssue(noTracking.error)).toBe(e.tracking);
    const badTracking = statusChangeSchema.safeParse({
      ...base,
      to: "shipped",
      courier: "ups",
      trackingNumber: "<script>",
    });
    expect(badTracking.success || firstIssue(badTracking.error)).toBe(e.trackingFormat);
  });

  it("reads the restock checkbox when cancelling", () => {
    const ticked = statusChangeSchema.parse({ ...base, to: "cancelled", restock: "on" });
    const unticked = statusChangeSchema.parse({ ...base, to: "cancelled" });
    expect(ticked).toMatchObject({ to: "cancelled", restock: true });
    expect(unticked).toMatchObject({ to: "cancelled", restock: false });
  });

  it("refuses statuses the admin can't set, and tampered hidden fields", () => {
    for (const bad of [
      { ...base, to: "refunded" },
      { ...base, to: "paid" },
      { ...base, to: "confirmed", orderId: "1" },
      { ...base, to: "confirmed", expectedFrom: "lost" },
    ]) {
      const result = statusChangeSchema.safeParse(bad);
      expect(result.success).toBe(false);
      if (!result.success) expect(firstIssue(result.error)).toBe(e.invalid);
    }
    const longNote = statusChangeSchema.safeParse({
      ...base,
      to: "confirmed",
      note: "x".repeat(1001),
    });
    expect(longNote.success || firstIssue(longNote.error)).toBe(e.tooLong);
  });
});

describe("internal note form", () => {
  it("needs some text", () => {
    const empty = orderNoteSchema.safeParse({ orderId: ORDER_ID, note: "   " });
    expect(empty.success || firstIssue(empty.error)).toBe(e.noteEmpty);
    expect(orderNoteSchema.parse({ orderId: ORDER_ID, note: " Call her " }).note).toBe("Call her");
  });

  it("form data becomes plain text fields", () => {
    const data = new FormData();
    data.set("orderId", ORDER_ID);
    data.set("file", new Blob(["x"]));
    expect(formFields(data)).toEqual({ orderId: ORDER_ID });
  });
});

describe("admin status buttons", () => {
  it("offer only the allowed next steps, never refunded", () => {
    expect(adminNextStatuses("paid", { hasCustomItems: false })).toEqual([
      "confirmed",
      "cancelled",
    ]);
    expect(adminNextStatuses("in_production", { hasCustomItems: false })).toEqual([
      "shipped",
      "cancelled",
    ]);
    expect(adminNextStatuses("in_production", { hasCustomItems: true })).toEqual(["shipped"]);
    expect(adminNextStatuses("shipped", { hasCustomItems: false })).toEqual(["delivered"]);
    for (const done of ["delivered", "cancelled", "refunded"] as const) {
      expect(adminNextStatuses(done, { hasCustomItems: false })).toEqual([]);
    }
  });

  it("email the customer on shipped, delivered and cancelled only", () => {
    expect(["shipped", "delivered", "cancelled"].every((s) => sendsStatusEmail(s as never))).toBe(
      true,
    );
    expect(sendsStatusEmail("confirmed")).toBe(false);
    expect(sendsStatusEmail("refunded")).toBe(false);
  });
});

describe("couriers", () => {
  it("link to the courier's tracking page", () => {
    expect(trackingUrl("dhl", " JD 0146 ")).toBe(
      "https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=JD%200146",
    );
    expect(trackingUrl("fedex", "1234")).toBe("https://www.fedex.com/fedextrack/?trknbr=1234");
    expect(trackingUrl("ups", "1Z99")).toBe("https://www.ups.com/track?tracknum=1Z99");
    expect(trackingUrl("other", "1234")).toBeNull();
    expect(trackingUrl("pigeon", "1234")).toBeNull();
  });

  it("have display names", () => {
    expect(courierName("dhl")).toBe("DHL Express");
    expect(courierName("Aramex")).toBe("Aramex");
  });
});
