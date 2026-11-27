import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";

import type Stripe from "stripe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { POST as cronDrafts } from "@/app/api/cron/drafts/route";
import type { BagLine } from "@/lib/bag-schema";
import { CheckoutProblemError, createCheckout, deleteOldDrafts } from "@/lib/checkout";
import { getDb } from "@/lib/db";
import { sendNewOrderEmails } from "@/lib/order-emails";
import { getStripe, getWebhookSecret } from "@/lib/stripe";
import { handleStripeEvent, InvalidSignatureError, verifyStripeEvent } from "@/lib/stripe-webhook";

// The checkout → Stripe → webhook → order path against the real database, with real Stripe
// signatures but no calls to Stripe's servers. Needs: pnpm db:up && pnpm db:deploy && pnpm db:seed
// Every order and draft created here is deleted afterwards, and stock is restored.

const db = getDb();
const PREFIX = "cs_test_it_";
const createdDraftIds: string[] = [];
let sizeS: { id: string; stock: number | null };
let sizeM: { id: string; stock: number | null };
let originalStock: Array<{ id: string; stock: number | null }> = [];

beforeAll(async () => {
  const blush = await db.product.findUniqueOrThrow({
    where: { slug: "blush-organza-lehenga" },
    include: { variants: true },
  });
  originalStock = blush.variants.map((v) => ({ id: v.id, stock: v.stock }));
  sizeS = blush.variants.find((v) => v.size.startsWith("S "))!;
  sizeM = blush.variants.find((v) => v.size.startsWith("M "))!;
});

afterEach(async () => {
  await db.order.deleteMany({ where: { stripeSessionId: { startsWith: PREFIX } } });
  await db.checkoutDraft.deleteMany({ where: { id: { in: createdDraftIds.splice(0) } } });
  for (const v of originalStock)
    await db.variant.update({ where: { id: v.id }, data: { stock: v.stock } });
});

afterAll(async () => {
  await db.$disconnect();
});

/** Measurements as a shopper typed them, in centimetres, with a note for the tailor. */
const customMeasurements = {
  kind: "women" as const,
  unit: "cm" as const,
  values: {
    bust: 91.5,
    underBust: 78,
    shoulder: 37.25,
    armhole: 40,
    upperArm: 28,
    waist: 74,
    hip: 99,
    shoulderToWaist: 38,
    sleeveLength: 20.5,
    waistToFloor: 104,
    height: 163,
  },
  notes: "I'll wear 3-inch heels",
};

const bagLine = (overrides: Partial<BagLine> = {}): BagLine => ({
  id: randomUUID(),
  productSlug: "blush-organza-lehenga",
  variantId: sizeS.id,
  custom: false,
  quantity: 1,
  ...overrides,
});

/** Runs checkout with a fake Stripe that records the request instead of sending it. */
async function checkout(lines: BagLine[]) {
  const createSession = vi.fn<
    (
      params: Stripe.Checkout.SessionCreateParams,
      options: Stripe.RequestOptions,
    ) => Promise<{ id: string; url: string }>
  >(async () => ({
    id: `${PREFIX}${randomUUID().replaceAll("-", "")}`,
    url: "https://checkout.stripe.com/c/pay/test",
  }));
  const result = await createCheckout(lines, createSession);
  createdDraftIds.push(result.draftId);
  return { ...result, params: createSession.mock.calls[0][0] };
}

function paidSession(draftId: string, sessionId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: sessionId,
    object: "checkout.session",
    status: "complete",
    payment_status: "paid",
    currency: "usd",
    amount_subtotal: 68000,
    amount_total: 68000,
    total_details: { amount_discount: 0, amount_shipping: 0, amount_tax: 0 },
    metadata: { draft_id: draftId },
    payment_intent: `pi_test_it_${randomUUID().replaceAll("-", "")}`,
    customer_details: { email: "it-buyer@example.com", name: "Asha Rao", phone: "+12025550123" },
    collected_information: {
      shipping_details: {
        name: "Asha Rao",
        address: {
          line1: "1 Main St",
          line2: null,
          city: "Edison",
          state: "NJ",
          postal_code: "08817",
          country: "US",
        },
      },
    },
    ...overrides,
  };
}

/** Builds a webhook exactly as Stripe sends it: JSON body + signature header. */
function signedEvent(type: string, object: unknown) {
  const payload = JSON.stringify({
    id: `evt_test_it_${randomUUID().replaceAll("-", "")}`,
    object: "event",
    api_version: "2026-10-28.endive",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type,
    data: { object },
  });
  const signature = getStripe().webhooks.generateTestHeaderString({
    payload,
    secret: getWebhookSecret(),
  });
  return { payload, signature };
}

function effects() {
  return { orderCreated: vi.fn(), orderRefunded: vi.fn() };
}

async function deliver(type: string, object: unknown, fx = effects()) {
  const { payload, signature } = signedEvent(type, object);
  return { result: await handleStripeEvent(verifyStripeEvent(payload, signature), fx), fx };
}

describe("checkout", () => {
  it("prices the bag on the server and saves a draft for the webhook", async () => {
    const { url, draftId, params } = await checkout([bagLine({ quantity: 2 })]);
    expect(url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    expect(params.line_items?.[0]).toMatchObject({
      quantity: 2,
      price_data: { unit_amount: 68000 },
    });
    const draft = await db.checkoutDraft.findUniqueOrThrow({ where: { id: draftId } });
    expect(draft.subtotalCents).toBe(136000);
    expect(draft.stripeSessionId).toMatch(new RegExp(`^${PREFIX}`));
  });

  it("refuses a custom-fit line without valid measurements and saves nothing", async () => {
    const before = await db.checkoutDraft.count();
    for (const measurements of [
      undefined,
      { ...customMeasurements, values: { ...customMeasurements.values, bust: 12 } },
      { ...customMeasurements, kind: "men" as const },
    ]) {
      const problem = await checkout([
        bagLine({ variantId: null, custom: true, measurements }),
      ]).catch((error: unknown) => error);
      expect(problem).toBeInstanceOf(CheckoutProblemError);
      expect((problem as CheckoutProblemError).bag.lines[0].problem).toBe("measurements_needed");
    }
    expect(await db.checkoutDraft.count()).toBe(before);
  });

  it("refuses a bag with a sold-out size and saves nothing", async () => {
    const before = await db.checkoutDraft.count();
    await expect(checkout([bagLine({ variantId: sizeM.id })])).rejects.toBeInstanceOf(
      CheckoutProblemError,
    );
    expect(await db.checkoutDraft.count()).toBe(before);
  });
});

describe("webhook signature", () => {
  it("rejects a missing, wrong or tampered signature", () => {
    const { payload, signature } = signedEvent("checkout.session.completed", {});
    expect(() => verifyStripeEvent(payload, null)).toThrow(InvalidSignatureError);
    expect(() => verifyStripeEvent(payload, "t=1,v1=bad")).toThrow(InvalidSignatureError);
    expect(() => verifyStripeEvent(payload.replace("event", "evil"), signature)).toThrow(
      InvalidSignatureError,
    );
    expect(verifyStripeEvent(payload, signature).type).toBe("checkout.session.completed");
  });
});

describe("order creation from the webhook", () => {
  it("creates one paid order with copied items, reduces stock and records the event", async () => {
    const { draftId, params } = await checkout([bagLine()]);
    const sessionId = (await db.checkoutDraft.findUniqueOrThrow({ where: { id: draftId } }))
      .stripeSessionId!;
    expect(params.metadata?.draft_id).toBe(draftId);

    const { result, fx } = await deliver(
      "checkout.session.completed",
      paidSession(draftId, sessionId),
    );
    expect(result.outcome).toBe("created");
    expect(fx.orderCreated).toHaveBeenCalledTimes(1);

    const order = await db.order.findUniqueOrThrow({
      where: { stripeSessionId: sessionId },
      include: { items: true, events: true },
    });
    expect(order.number).toMatch(/^VRS-\d{4,}$/);
    expect(order).toMatchObject({
      status: "paid",
      email: "it-buyer@example.com",
      customerName: "Asha Rao",
      subtotalCents: 68000,
      totalCents: 68000,
      currency: "USD",
    });
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({
      titleSnapshot: "Blush organza lehenga",
      size: "S (US 4–6)",
      unitPriceCents: 68000,
      quantity: 1,
      isCustom: false,
    });
    expect(order.events.map((e) => e.toStatus)).toEqual(["paid"]);
    expect((await db.variant.findUniqueOrThrow({ where: { id: sizeS.id } })).stock).toBe(
      (sizeS.stock ?? 0) - 1,
    );
  });

  it("copies the exact custom-fit measurements into the order", async () => {
    const { draftId, params } = await checkout([
      bagLine({ variantId: null, custom: true, measurements: customMeasurements }),
    ]);
    expect(params.line_items?.[0]).toMatchObject({ price_data: { unit_amount: 72500 } });
    const draft = await db.checkoutDraft.findUniqueOrThrow({ where: { id: draftId } });
    expect((draft.items as Array<{ measurements: unknown }>)[0].measurements).toEqual(
      customMeasurements,
    );

    await deliver(
      "checkout.session.completed",
      paidSession(draftId, draft.stripeSessionId!, { amount_subtotal: 72500, amount_total: 72500 }),
    );
    const order = await db.order.findUniqueOrThrow({
      where: { stripeSessionId: draft.stripeSessionId! },
      include: { items: true },
    });
    expect(order.items[0]).toMatchObject({ isCustom: true, size: null, productionDays: 28 });
    expect(order.items[0].measurements).toEqual(customMeasurements);
  });

  it("creates only one order when Stripe sends the same event twice", async () => {
    const { draftId } = await checkout([bagLine()]);
    const sessionId = (await db.checkoutDraft.findUniqueOrThrow({ where: { id: draftId } }))
      .stripeSessionId!;
    const session = paidSession(draftId, sessionId);

    const first = await deliver("checkout.session.completed", session);
    const second = await deliver("checkout.session.completed", session);
    expect(first.result.outcome).toBe("created");
    expect(second.result.outcome).toBe("exists");
    expect(second.fx.orderCreated).not.toHaveBeenCalled();
    expect(await db.order.count({ where: { stripeSessionId: sessionId } })).toBe(1);
    expect((await db.variant.findUniqueOrThrow({ where: { id: sizeS.id } })).stock).toBe(
      (sizeS.stock ?? 0) - 1,
    );
  });

  it("creates only one order when two deliveries arrive at the same moment", async () => {
    const { draftId } = await checkout([bagLine()]);
    const sessionId = (await db.checkoutDraft.findUniqueOrThrow({ where: { id: draftId } }))
      .stripeSessionId!;
    const session = paidSession(draftId, sessionId);

    const results = await Promise.all([
      deliver("checkout.session.completed", session),
      deliver("checkout.session.completed", session),
    ]);
    expect(results.map((r) => r.result.outcome).sort()).toEqual(["created", "exists"]);
    expect(await db.order.count({ where: { stripeSessionId: sessionId } })).toBe(1);
  });

  it("ignores a session that isn't paid", async () => {
    const { draftId } = await checkout([bagLine()]);
    const sessionId = (await db.checkoutDraft.findUniqueOrThrow({ where: { id: draftId } }))
      .stripeSessionId!;
    const { result } = await deliver(
      "checkout.session.completed",
      paidSession(draftId, sessionId, { payment_status: "unpaid" }),
    );
    expect(result.outcome).toBe("skipped");
    expect(await db.order.count({ where: { stripeSessionId: sessionId } })).toBe(0);
  });

  it("keeps the order but flags it when the last piece was sold meanwhile", async () => {
    const { draftId } = await checkout([bagLine({ quantity: 2 })]);
    const sessionId = (await db.checkoutDraft.findUniqueOrThrow({ where: { id: draftId } }))
      .stripeSessionId!;
    await db.variant.update({ where: { id: sizeS.id }, data: { stock: 1 } });

    await deliver(
      "checkout.session.completed",
      paidSession(draftId, sessionId, { amount_subtotal: 136000, amount_total: 136000 }),
    );
    const order = await db.order.findUniqueOrThrow({
      where: { stripeSessionId: sessionId },
      include: { events: true },
    });
    expect(order.events.some((e) => e.note?.startsWith("Oversold"))).toBe(true);
    expect((await db.variant.findUniqueOrThrow({ where: { id: sizeS.id } })).stock).toBe(0);
  });

  it("records a promotion-code discount so the total still adds up", async () => {
    const { draftId } = await checkout([bagLine()]);
    const sessionId = (await db.checkoutDraft.findUniqueOrThrow({ where: { id: draftId } }))
      .stripeSessionId!;
    await deliver(
      "checkout.session.completed",
      paidSession(draftId, sessionId, {
        amount_total: 61200,
        total_details: { amount_discount: 6800, amount_shipping: 0, amount_tax: 0 },
      }),
    );
    const order = await db.order.findUniqueOrThrow({ where: { stripeSessionId: sessionId } });
    expect(order).toMatchObject({ subtotalCents: 68000, discountCents: 6800, totalCents: 61200 });
  });
});

describe("currency safety", () => {
  it("records a payment made in another currency in US dollars, with a note", async () => {
    const { draftId } = await checkout([bagLine()]);
    const sessionId = (await db.checkoutDraft.findUniqueOrThrow({ where: { id: draftId } }))
      .stripeSessionId!;
    await deliver(
      "checkout.session.completed",
      paidSession(draftId, sessionId, {
        currency: "inr",
        amount_subtotal: 6522864,
        amount_total: 6522864,
        currency_conversion: {
          source_currency: "usd",
          amount_subtotal: 68000,
          amount_total: 68000,
          fx_rate: "95.92",
        },
      }),
    );
    const order = await db.order.findUniqueOrThrow({
      where: { stripeSessionId: sessionId },
      include: { events: true },
    });
    expect(order).toMatchObject({ currency: "USD", subtotalCents: 68000, totalCents: 68000 });
    expect(order.events.some((e) => e.note?.includes("paid in INR"))).toBe(true);
  });
});

describe("refunds from Stripe", () => {
  async function paidOrder() {
    const { draftId } = await checkout([bagLine()]);
    const sessionId = (await db.checkoutDraft.findUniqueOrThrow({ where: { id: draftId } }))
      .stripeSessionId!;
    const session = paidSession(draftId, sessionId);
    await deliver("checkout.session.completed", session);
    return { sessionId, paymentIntent: session.payment_intent };
  }

  const charge = (paymentIntent: string, refunded: boolean, amountRefunded: number) => ({
    id: `ch_test_it_${randomUUID().replaceAll("-", "")}`,
    object: "charge",
    payment_intent: paymentIntent,
    refunded,
    amount: 68000,
    amount_refunded: amountRefunded,
  });

  it("marks a fully refunded order as refunded, once", async () => {
    const { sessionId, paymentIntent } = await paidOrder();
    const full = charge(paymentIntent, true, 68000);

    const first = await deliver("charge.refunded", full);
    const again = await deliver("charge.refunded", full);
    expect(first.result.outcome).toBe("refunded");
    expect(first.fx.orderRefunded).toHaveBeenCalledWith(expect.any(String), 68000);
    expect(again.result.outcome).toBe("skipped");

    const order = await db.order.findUniqueOrThrow({
      where: { stripeSessionId: sessionId },
      include: { events: { orderBy: { createdAt: "asc" } } },
    });
    expect(order.status).toBe("refunded");
    expect(order.refundedAt).not.toBeNull();
    expect(order.events.filter((e) => e.toStatus === "refunded")).toHaveLength(1);
  });

  it("notes a partial refund without changing the status, even if delivered twice", async () => {
    const { sessionId, paymentIntent } = await paidOrder();
    const { payload, signature } = signedEvent(
      "charge.refunded",
      charge(paymentIntent, false, 2500),
    );
    const event = verifyStripeEvent(payload, signature);
    await handleStripeEvent(event, effects());
    await handleStripeEvent(event, effects());

    const order = await db.order.findUniqueOrThrow({
      where: { stripeSessionId: sessionId },
      include: { events: true },
    });
    expect(order.status).toBe("paid");
    expect(order.events.filter((e) => e.note?.startsWith("Partial refund"))).toHaveLength(1);
  });
});

describe("order emails", () => {
  it("sends the confirmation (to .outbox/ locally) and marks it sent", async () => {
    const { draftId } = await checkout([bagLine()]);
    const sessionId = (await db.checkoutDraft.findUniqueOrThrow({ where: { id: draftId } }))
      .stripeSessionId!;
    let orderId = "";
    await deliver("checkout.session.completed", paidSession(draftId, sessionId), {
      orderCreated: (id: string) => {
        orderId = id;
      },
      orderRefunded: vi.fn(),
    } as never);

    await sendNewOrderEmails(orderId);
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.confirmationSentAt).not.toBeNull();
    const files = await readdir(".outbox");
    expect(files.some((f) => f.includes("order-confirmation") && f.includes("it_buyer"))).toBe(
      true,
    );
  });
});

describe("old checkout drafts", () => {
  const DAY = 24 * 60 * 60 * 1000;

  async function draftCreatedAt(createdAt: Date) {
    const draft = await db.checkoutDraft.create({
      data: { items: [], subtotalCents: 100, createdAt },
      select: { id: true },
    });
    createdDraftIds.push(draft.id);
    return draft.id;
  }

  it("deletes drafts older than 7 days and keeps newer ones", async () => {
    const now = new Date();
    const oldId = await draftCreatedAt(new Date(now.getTime() - 8 * DAY));
    const recentId = await draftCreatedAt(new Date(now.getTime() - 6 * DAY));

    const result = await deleteOldDrafts(now);

    expect(result.deleted).toBeGreaterThanOrEqual(1);
    expect(await db.checkoutDraft.findUnique({ where: { id: oldId } })).toBeNull();
    expect(await db.checkoutDraft.findUnique({ where: { id: recentId } })).not.toBeNull();
  });

  it("runs from /api/cron/drafts only with the cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "it-cron-secret");
    try {
      const oldId = await draftCreatedAt(new Date(Date.now() - 30 * DAY));
      const url = "http://localhost/api/cron/drafts";

      const denied = await cronDrafts(new Request(url, { method: "POST" }));
      expect(denied.status).toBe(401);
      expect(await db.checkoutDraft.findUnique({ where: { id: oldId } })).not.toBeNull();

      const allowed = await cronDrafts(
        new Request(url, { method: "POST", headers: { authorization: "Bearer it-cron-secret" } }),
      );
      expect(allowed.status).toBe(200);
      expect((await allowed.json()).deleted).toBeGreaterThanOrEqual(1);
      expect(await db.checkoutDraft.findUnique({ where: { id: oldId } })).toBeNull();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
