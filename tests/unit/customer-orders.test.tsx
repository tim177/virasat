import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";

import {
  FitCallReminderEmail,
  OrderConfirmationEmail,
  OrderShippedEmail,
  type EmailOrder,
} from "@/emails/order-emails";
import { describeChanges } from "@/lib/admin-log-view";
import { fitCallBaseUrl, fitCallUrl, needsFitCall } from "@/lib/fit-call";
import { customerTimeline } from "@/lib/order-timeline";

const at = (day: number) => new Date(Date.UTC(2026, 10, day, 15));

describe("the customer's order timeline", () => {
  it("shows the steps done, the one in progress and the ones to come", () => {
    const steps = customerTimeline("confirmed", [
      { toStatus: "paid", createdAt: at(1) },
      { toStatus: null, createdAt: at(1) }, // an internal note: ignored
      { toStatus: "confirmed", createdAt: at(3) },
    ]);
    expect(steps).toEqual([
      { status: "paid", state: "complete", date: at(1) },
      { status: "confirmed", state: "complete", date: at(3) },
      { status: "in_production", state: "current", date: null },
      { status: "shipped", state: "upcoming", date: null },
      { status: "delivered", state: "upcoming", date: null },
    ]);
  });

  it("is all done once delivered", () => {
    const steps = customerTimeline("delivered", [
      { toStatus: "paid", createdAt: at(1) },
      { toStatus: "confirmed", createdAt: at(2) },
      { toStatus: "in_production", createdAt: at(3) },
      { toStatus: "shipped", createdAt: at(5) },
      { toStatus: "delivered", createdAt: at(9) },
    ]);
    expect(steps.map((s) => s.state)).toEqual(Array(5).fill("complete"));
    expect(steps.at(-1)?.date).toEqual(at(9));
  });

  it("ends with the cancellation or refund instead of steps that won't happen", () => {
    expect(
      customerTimeline("cancelled", [
        { toStatus: "paid", createdAt: at(1) },
        { toStatus: "confirmed", createdAt: at(2) },
        { toStatus: "cancelled", createdAt: at(4) },
      ]).map((s) => [s.status, s.state]),
    ).toEqual([
      ["paid", "complete"],
      ["confirmed", "complete"],
      ["cancelled", "complete"],
    ]);
    expect(
      customerTimeline("refunded", [
        { toStatus: "paid", createdAt: at(1) },
        { toStatus: "cancelled", createdAt: at(2) },
        { toStatus: "refunded", createdAt: at(3) },
      ]).map((s) => s.status),
    ).toEqual(["paid", "cancelled", "refunded"]);
  });

  it("uses the first time a status was reached, whatever order the events come in", () => {
    const steps = customerTimeline("paid", [
      { toStatus: "paid", createdAt: at(5) },
      { toStatus: "paid", createdAt: at(1) },
    ]);
    expect(steps[0].date).toEqual(at(1));
  });
});

describe("fit-call links", () => {
  const order = { number: "VRS-1042", customerName: "Asha Rao", email: "asha+fit@example.com" };

  it("needs an https booking page", () => {
    expect(fitCallBaseUrl({})).toBeNull();
    expect(fitCallBaseUrl({ CALCOM_FIT_CALL_URL: "  " })).toBeNull();
    expect(fitCallBaseUrl({ CALCOM_FIT_CALL_URL: "http://cal.com/virasat/fit" })).toBeNull();
    expect(fitCallBaseUrl({ CALCOM_FIT_CALL_URL: "not a url" })).toBeNull();
    expect(fitCallBaseUrl({ CALCOM_FIT_CALL_URL: "https://cal.com/virasat/fit-call" })).toBe(
      "https://cal.com/virasat/fit-call",
    );
  });

  it("fills in the customer's name, email and order number", () => {
    const url = new URL(fitCallUrl("https://cal.com/virasat/fit-call", order) ?? "");
    expect(url.origin + url.pathname).toBe("https://cal.com/virasat/fit-call");
    expect(url.searchParams.get("name")).toBe("Asha Rao");
    expect(url.searchParams.get("email")).toBe("asha+fit@example.com");
    expect(url.searchParams.get("notes")).toBe("Fit call for order VRS-1042");
    expect(url.searchParams.get("metadata[order]")).toBe("VRS-1042");
    expect(fitCallUrl(null, order)).toBeNull();
  });

  it("is only needed while a custom-fit order is paid and not yet booked", () => {
    const base = { status: "paid" as const, hasCustomItems: true, fitCallBookedAt: null };
    expect(needsFitCall(base)).toBe(true);
    expect(needsFitCall({ ...base, hasCustomItems: false })).toBe(false);
    expect(needsFitCall({ ...base, fitCallBookedAt: at(2) })).toBe(false);
    expect(needsFitCall({ ...base, status: "confirmed" })).toBe(false);
  });
});

describe("order emails link to the order page and the fit call", () => {
  const order: EmailOrder = {
    number: "VRS-1042",
    customerName: "Asha Rao",
    email: "asha@example.com",
    shippingAddress: {
      line1: "1 Main St",
      line2: null,
      city: "Edison",
      state: "NJ",
      postalCode: "08817",
      country: "US",
    },
    subtotalCents: 98000,
    discountCents: 0,
    shippingCents: 0,
    totalCents: 98000,
    statusUrl: "https://www.example.com/orders/VRS-1042?t=secret-token-1234567890",
    fitCallUrl: "https://cal.com/virasat/fit-call?name=Asha",
    items: [
      {
        title: "Emerald velvet lehenga",
        size: null,
        isCustom: true,
        quantity: 1,
        unitPriceCents: 98000,
      },
    ],
  };

  it("confirmation: order link and the fit-call button", async () => {
    const html = await render(<OrderConfirmationEmail order={order} />);
    expect(html).toContain(
      'href="https://www.example.com/orders/VRS-1042?t=secret-token-1234567890"',
    );
    expect(html).toContain('href="https://cal.com/virasat/fit-call?name=Asha"');
    expect(html).toContain("Book your fit call");

    const noCal = await render(<OrderConfirmationEmail order={{ ...order, fitCallUrl: null }} />);
    expect(noCal).not.toContain("cal.com");
    expect(noCal).toContain("book a short fit call");
  });

  it("shipped: order link", async () => {
    const html = await render(
      <OrderShippedEmail
        order={order}
        courier="DHL Express"
        trackingNumber="JD014600006281"
        trackingUrl={null}
        shippingDays={{ min: 4, max: 7 }}
      />,
    );
    expect(html).toContain("/orders/VRS-1042?t=");
  });

  it("fit-call reminder: the booking button, or reply instructions without Cal.com", async () => {
    const html = await render(<FitCallReminderEmail order={order} />);
    expect(html).toContain("Book your fit call");
    expect(html).toContain("Already booked?");
    const noCal = await render(<FitCallReminderEmail order={{ ...order, fitCallUrl: null }} />);
    expect(noCal).toContain("Reply to this email");
  });
});

describe("admin log of a measurement change", () => {
  it("shows each changed measurement by its form label", () => {
    expect(
      describeChanges(
        { piece: "Emerald velvet lehenga", "6. Waist": "29 in", "7. Hip": "39 in" },
        { piece: "Emerald velvet lehenga", "6. Waist": "30.5 in", "7. Hip": "39 in" },
      ),
    ).toEqual([{ field: "6. Waist", label: "6. Waist", before: "29 in", after: "30.5 in" }]);
    expect(describeChanges({ fitCallBooked: false }, { fitCallBooked: true })).toEqual([
      { field: "fitCallBooked", label: "Fit call booked", before: "No", after: "Yes" },
    ]);
  });
});
