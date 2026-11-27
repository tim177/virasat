import { afterEach, describe, expect, it, vi } from "vitest";

import { bagLineSchema } from "@/lib/bag-schema";
import { buildCheckoutSessionParams } from "@/lib/checkout-session";
import { isCronRequest } from "@/lib/cron-auth";
import type { DraftLine } from "@/lib/draft-schema";
import { canTransition, nextStatuses } from "@/lib/order-status";
import { priceBag, type PricingProduct } from "@/lib/pricing";

const VARIANT_S = "0190a0b0-0000-7000-8000-000000000001";
const VARIANT_M = "0190a0b0-0000-7000-8000-000000000002";
const VARIANT_L = "0190a0b0-0000-7000-8000-000000000003";

const lehenga: PricingProduct = {
  id: "0190a0b0-0000-7000-8000-0000000000aa",
  slug: "test-lehenga",
  title: "Test lehenga",
  gender: "women",
  published: true,
  priceCents: 68000,
  customFitAvailable: true,
  customFitExtraCents: 4500,
  readyDays: 3,
  customDays: 28,
  imageUrl: "/seed/x.webp",
  variants: [
    { id: VARIANT_S, size: "S (US 4–6)", stock: 3 },
    { id: VARIANT_M, size: "M (US 8–10)", stock: 0 },
    { id: VARIANT_L, size: "L (US 12–14)", stock: null },
  ],
};

const products = new Map([[lehenga.slug, lehenga]]);

const womensMeasurements = {
  kind: "women" as const,
  unit: "in" as const,
  values: {
    bust: 36,
    underBust: 31,
    shoulder: 14.5,
    armhole: 16,
    upperArm: 11,
    waist: 29,
    hip: 39,
    shoulderToWaist: 15,
    sleeveLength: 8,
    waistToFloor: 41,
    height: 64,
  },
};
const line = (overrides: Partial<Parameters<typeof priceBag>[0][number]> = {}) => ({
  id: "line-1",
  productSlug: "test-lehenga",
  variantId: VARIANT_S,
  custom: false,
  quantity: 1,
  ...overrides,
});

describe("priceBag", () => {
  it("prices a size from the database price, in cents", () => {
    const bag = priceBag([line({ quantity: 2 })], products);
    expect(bag.ok).toBe(true);
    expect(bag.lines[0]).toMatchObject({
      unitPriceCents: 68000,
      lineTotalCents: 136000,
      size: "S (US 4–6)",
      productionDays: 3,
      problem: null,
    });
    expect(bag.subtotalCents).toBe(136000);
  });

  it("adds the custom-fit extra and uses the custom making time", () => {
    const bag = priceBag(
      [line({ id: "c", variantId: null, custom: true, measurements: womensMeasurements })],
      products,
    );
    expect(bag.ok).toBe(true);
    expect(bag.lines[0]).toMatchObject({
      isCustom: true,
      size: null,
      unitPriceCents: 72500,
      productionDays: 28,
      measurementKind: "women",
      measurements: womensMeasurements,
      problem: null,
    });
  });

  it("needs complete, in-range measurements for the right kind on custom-fit lines", () => {
    const custom = (measurements: unknown) =>
      priceBag(
        [line({ id: "c", variantId: null, custom: true, measurements: measurements as never })],
        products,
      ).lines[0];

    expect(custom(undefined)).toMatchObject({ problem: "measurements_needed", measurements: null });
    expect(custom(null).problem).toBe("measurements_needed");
    // Out of range (the browser can't be trusted), missing one, or men's for a women's piece.
    expect(
      custom({ ...womensMeasurements, values: { ...womensMeasurements.values, bust: 99 } }).problem,
    ).toBe("measurements_needed");
    const withoutBust = Object.fromEntries(
      Object.entries(womensMeasurements.values).filter(([key]) => key !== "bust"),
    );
    expect(custom({ ...womensMeasurements, values: withoutBust }).problem).toBe(
      "measurements_needed",
    );
    expect(custom({ ...womensMeasurements, kind: "men" }).problem).toBe("measurements_needed");
    // The price is still shown, so the bag can say what's missing.
    expect(custom(undefined).unitPriceCents).toBe(72500);
  });

  it("treats empty stock as made to order", () => {
    expect(priceBag([line({ variantId: VARIANT_L, quantity: 5 })], products).ok).toBe(true);
  });

  it("flags sold-out sizes and too few in stock", () => {
    const soldOut = priceBag([line({ variantId: VARIANT_M })], products);
    expect(soldOut.ok).toBe(false);
    expect(soldOut.lines[0].problem).toBe("sold_out");

    const short = priceBag([line({ quantity: 5 })], products);
    expect(short.lines[0]).toMatchObject({ problem: "not_enough_stock", availableQuantity: 3 });
  });

  it("flags unknown, unpublished and no-longer-custom products", () => {
    expect(priceBag([line({ productSlug: "missing" })], products).lines[0].problem).toBe(
      "unavailable",
    );

    const drafts = new Map([[lehenga.slug, { ...lehenga, published: false }]]);
    expect(priceBag([line()], drafts).lines[0].problem).toBe("unavailable");

    const noCustom = new Map([[lehenga.slug, { ...lehenga, customFitAvailable: false }]]);
    expect(priceBag([line({ variantId: null, custom: true })], noCustom).lines[0].problem).toBe(
      "custom_unavailable",
    );
  });

  it("only counts buyable lines in the subtotal", () => {
    const bag = priceBag([line({ id: "a" }), line({ id: "b", variantId: VARIANT_M })], products);
    expect(bag.subtotalCents).toBe(68000);
    expect(bag.ok).toBe(false);
  });
});

describe("bagLineSchema", () => {
  it("accepts a size line and a custom-fit line", () => {
    expect(bagLineSchema.safeParse(line()).success).toBe(true);
    expect(bagLineSchema.safeParse(line({ variantId: null, custom: true })).success).toBe(true);
    expect(
      bagLineSchema.safeParse(
        line({ variantId: null, custom: true, measurements: womensMeasurements }),
      ).success,
    ).toBe(true);
  });

  it.each([
    ["custom fit with a size", { custom: true }],
    ["size line without a size", { variantId: null }],
    ["zero quantity", { quantity: 0 }],
    ["too many", { quantity: 6 }],
    ["fractional quantity", { quantity: 1.5 }],
    ["bad slug", { productSlug: "../etc/passwd" }],
    ["not a uuid", { variantId: "123" }],
    ["measurements on a size line", { measurements: womensMeasurements }],
    [
      "measurements that aren't numbers",
      {
        variantId: null,
        custom: true,
        measurements: { kind: "women", unit: "in", values: { bust: "36" } },
      },
    ],
  ])("rejects %s", (_name, overrides) => {
    expect(bagLineSchema.safeParse(line(overrides as never)).success).toBe(false);
  });
});

describe("order status rules", () => {
  const plain = { hasCustomItems: false };
  const custom = { hasCustomItems: true };

  it("moves forward one step at a time", () => {
    expect(canTransition("paid", "confirmed", plain)).toBe(true);
    expect(canTransition("confirmed", "in_production", plain)).toBe(true);
    expect(canTransition("in_production", "shipped", plain)).toBe(true);
    expect(canTransition("shipped", "delivered", plain)).toBe(true);
    expect(canTransition("paid", "shipped", plain)).toBe(false);
    expect(canTransition("delivered", "shipped", plain)).toBe(false);
  });

  it("only cancels custom-fit orders before production", () => {
    expect(canTransition("paid", "cancelled", custom)).toBe(true);
    expect(canTransition("confirmed", "cancelled", custom)).toBe(true);
    expect(canTransition("in_production", "cancelled", custom)).toBe(false);
    expect(canTransition("in_production", "cancelled", plain)).toBe(true);
    expect(canTransition("shipped", "cancelled", plain)).toBe(false);
  });

  it("allows a full refund from any status, once", () => {
    for (const from of [
      "paid",
      "confirmed",
      "in_production",
      "shipped",
      "delivered",
      "cancelled",
    ] as const) {
      expect(canTransition(from, "refunded", custom), from).toBe(true);
    }
    expect(canTransition("refunded", "refunded", plain)).toBe(false);
    expect(nextStatuses("refunded", plain)).toEqual([]);
  });

  it("lists the next possible statuses for admin buttons", () => {
    expect(nextStatuses("in_production", custom)).toEqual(["shipped", "refunded"]);
    expect(nextStatuses("paid", plain)).toEqual(["confirmed", "cancelled", "refunded"]);
  });
});

describe("buildCheckoutSessionParams", () => {
  const draftLines: DraftLine[] = [
    {
      productId: lehenga.id,
      variantId: VARIANT_S,
      productSlug: "test-lehenga",
      title: "Test lehenga",
      size: "S (US 4–6)",
      isCustom: false,
      quantity: 2,
      unitPriceCents: 68000,
      productionDays: 3,
      imageUrl: "/seed/x.webp",
      measurements: null,
    },
    {
      productId: lehenga.id,
      variantId: null,
      productSlug: "test-lehenga",
      title: "Test lehenga",
      size: null,
      isCustom: true,
      quantity: 1,
      unitPriceCents: 72500,
      productionDays: 28,
      imageUrl: null,
      measurements: null,
    },
  ];

  it("sends our server prices in cents, US shipping only, and the draft id", () => {
    const params = buildCheckoutSessionParams("draft-1", draftLines, "http://localhost:3000");
    expect(params.mode).toBe("payment");
    expect(params.line_items).toEqual([
      expect.objectContaining({
        quantity: 2,
        price_data: expect.objectContaining({
          currency: "usd",
          unit_amount: 68000,
          product_data: expect.objectContaining({ name: "Test lehenga (S (US 4–6))" }),
        }),
      }),
      expect.objectContaining({
        quantity: 1,
        price_data: expect.objectContaining({
          unit_amount: 72500,
          product_data: expect.objectContaining({ name: "Test lehenga (custom fit)" }),
        }),
      }),
    ]);
    expect(params.shipping_address_collection).toEqual({ allowed_countries: ["US"] });
    expect(params.adaptive_pricing).toEqual({ enabled: false });
    expect(params.metadata).toEqual({ draft_id: "draft-1" });
    expect(params.success_url).toBe(
      "http://localhost:3000/checkout/success?session_id={CHECKOUT_SESSION_ID}",
    );
    expect(params.cancel_url).toBe("http://localhost:3000/bag");
  });

  it("only sends photos when the site is public over https", () => {
    const local = buildCheckoutSessionParams("d", draftLines, "http://localhost:3000");
    expect(local.line_items?.[0].price_data?.product_data?.images).toBeUndefined();
    const live = buildCheckoutSessionParams("d", draftLines, "https://www.example.com");
    expect(live.line_items?.[0].price_data?.product_data?.images).toEqual([
      "https://www.example.com/seed/x.webp",
    ]);
  });
});

describe("cron route protection", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const cronRequest = (authorization?: string) =>
    new Request("http://localhost/api/cron/drafts", {
      method: "POST",
      headers: authorization ? { authorization } : {},
    });

  it("accepts only the exact bearer secret", () => {
    vi.stubEnv("CRON_SECRET", "s3cret-value");
    expect(isCronRequest(cronRequest("Bearer s3cret-value"))).toBe(true);
    expect(isCronRequest(cronRequest("Bearer s3cret-valuX"))).toBe(false);
    expect(isCronRequest(cronRequest("Bearer s3cret"))).toBe(false);
    expect(isCronRequest(cronRequest("s3cret-value"))).toBe(false);
    expect(isCronRequest(cronRequest())).toBe(false);
  });

  it("stays closed while CRON_SECRET is unset", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(isCronRequest(cronRequest("Bearer "))).toBe(false);
    expect(isCronRequest(cronRequest("Bearer undefined"))).toBe(false);
  });
});
