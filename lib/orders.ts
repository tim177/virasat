import "server-only";

import { randomBytes } from "node:crypto";

import type Stripe from "stripe";
import { z } from "zod";

import { writeAdminLog, type AdminActor } from "@/lib/admin-log";
import { courierName } from "@/lib/couriers";
import { getDb } from "@/lib/db";
import { draftLinesSchema } from "@/lib/draft-schema";
import { Prisma, type OrderStatus } from "@/lib/generated/prisma/client";
import { describeMeasurements } from "@/lib/measurement-display";
import { measurementSetSchema, type MeasurementSet } from "@/lib/measurements";
import { formatCents } from "@/lib/money";
import { canTransition, InvalidTransitionError, statusTimestampField } from "@/lib/order-status";

// Order writes. Orders are only ever created here, from a paid Stripe Checkout Session, and
// statuses only change through transitionOrder (CLAUDE.md rules 2 and 3).

export type OrderResult =
  | { status: "created"; orderId: string; number: string }
  | { status: "exists"; orderId: string; number: string }
  | { status: "skipped"; reason: string };

const shippingAddressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().nullable(),
  city: z.string().min(1),
  state: z.string().nullable(),
  postalCode: z.string().min(1),
  country: z.string().length(2),
});

/**
 * What the customer paid, in US cents. Stripe's figures satisfy
 * total = subtotal − discount + shipping (also a database rule).
 */
export function usdAmounts(
  session: Pick<
    Stripe.Checkout.Session,
    "currency" | "amount_subtotal" | "amount_total" | "total_details" | "currency_conversion"
  >,
) {
  if (session.currency === "usd") {
    const subtotalCents = session.amount_subtotal ?? 0;
    const discountCents = session.total_details?.amount_discount ?? 0;
    const shippingCents = session.total_details?.amount_shipping ?? 0;
    const totalCents = session.amount_total ?? subtotalCents - discountCents + shippingCents;
    return { subtotalCents, discountCents, shippingCents, totalCents, notes: [] as string[] };
  }
  const conversion = session.currency_conversion;
  if (conversion?.source_currency === "usd") {
    return {
      subtotalCents: conversion.amount_subtotal,
      discountCents: conversion.amount_subtotal - conversion.amount_total,
      shippingCents: 0,
      totalCents: conversion.amount_total,
      notes: [
        `The customer paid in ${session.currency?.toUpperCase()}; amounts here are the US-dollar prices.`,
      ],
    };
  }
  throw new Error(`Unexpected payment currency "${session.currency}" with no US-dollar amounts`);
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Creates the order for a paid Checkout Session, exactly once.
 * Safe to call again for the same session (Stripe retries webhooks): returns "exists".
 */
export async function createOrderFromSession(
  session: Stripe.Checkout.Session,
): Promise<OrderResult> {
  if (session.payment_status !== "paid") {
    return { status: "skipped", reason: `payment_status is ${session.payment_status}` };
  }

  const db = getDb();
  const existing = await db.order.findUnique({
    where: { stripeSessionId: session.id },
    select: { id: true, number: true },
  });
  if (existing) return { status: "exists", orderId: existing.id, number: existing.number };

  const draftId = z.uuid().safeParse(session.metadata?.draft_id);
  if (!draftId.success) return { status: "skipped", reason: "session has no valid draft_id" };
  const draft = await db.checkoutDraft.findUnique({ where: { id: draftId.data } });
  if (!draft) return { status: "skipped", reason: `draft ${draftId.data} not found` };

  const lines = draftLinesSchema.parse(draft.items);
  const customer = session.customer_details;
  const shipping = session.collected_information?.shipping_details;
  if (!customer?.email || !shipping) {
    throw new Error(`Session ${session.id} is missing the email or shipping address`);
  }
  const address = shippingAddressSchema.parse({
    line1: shipping.address.line1,
    line2: shipping.address.line2 ?? null,
    city: shipping.address.city,
    state: shipping.address.state ?? null,
    postalCode: shipping.address.postal_code,
    country: shipping.address.country,
  });

  // Orders are always recorded in US dollars. We switch off Stripe's local-currency pricing,
  // but if a payment ever arrives in another currency, use Stripe's US-dollar source amounts.
  const amounts = usdAmounts(session);
  const { subtotalCents, discountCents, shippingCents, totalCents } = amounts;
  const notes: string[] = [...amounts.notes];
  if (subtotalCents !== draft.subtotalCents) {
    notes.push(
      `Check this order: the bag was ${formatCents(draft.subtotalCents)} but Stripe charged a subtotal of ${formatCents(subtotalCents)}.`,
    );
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  try {
    const order = await db.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          email: customer.email as string,
          phone: customer.phone ?? null,
          customerName: shipping.name || customer.name || "Customer",
          shippingAddress: address,
          subtotalCents,
          discountCents,
          shippingCents,
          totalCents,
          stripeSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
          accessToken: randomBytes(24).toString("base64url"),
          userId: draft.userId,
          items: {
            create: lines.map((line) => ({
              productId: line.productId,
              variantId: line.variantId,
              titleSnapshot: line.title,
              imageSnapshot: line.imageUrl,
              size: line.size,
              isCustom: line.isCustom,
              measurements: line.measurements
                ? (line.measurements as Prisma.InputJsonObject)
                : Prisma.JsonNull,
              unitPriceCents: line.unitPriceCents,
              quantity: line.quantity,
              productionDays: line.productionDays,
            })),
          },
          events: {
            create: { toStatus: "paid", actor: "stripe", note: `Paid ${formatCents(totalCents)}` },
          },
        },
        select: { id: true, number: true },
      });

      // Reduce stock atomically. If someone bought the last piece a moment earlier, the payment
      // has still been taken: keep the order, set stock to 0 and flag it for a refund.
      const oversold: string[] = [];
      for (const line of lines) {
        if (!line.variantId) continue;
        const updated = await tx.$executeRaw`
          UPDATE variants SET stock = stock - ${line.quantity}
          WHERE id = ${line.variantId}::uuid AND stock IS NOT NULL AND stock >= ${line.quantity}`;
        if (updated === 0) {
          const variant = await tx.variant.findUnique({
            where: { id: line.variantId },
            select: { stock: true },
          });
          if (variant && variant.stock !== null) {
            await tx.variant.update({ where: { id: line.variantId }, data: { stock: 0 } });
            oversold.push(`${line.title} (${line.size}) × ${line.quantity}`);
          }
        }
      }
      if (oversold.length > 0) {
        notes.push(
          `Oversold, not enough stock: ${oversold.join("; ")}. Refund or offer a replacement.`,
        );
      }
      if (notes.length > 0) {
        await tx.orderEvent.createMany({
          data: notes.map((note) => ({ orderId: created.id, actor: "system", note })),
        });
      }
      return created;
    });
    return { status: "created", orderId: order.id, number: order.number };
  } catch (error) {
    // Two deliveries of the same event at the same moment: the database let only one through.
    if (isUniqueViolation(error)) {
      const winner = await db.order.findUnique({
        where: { stripeSessionId: session.id },
        select: { id: true, number: true },
      });
      if (winner) return { status: "exists", orderId: winner.id, number: winner.number };
    }
    throw error;
  }
}

/** The order moved on since the admin's page loaded (another tab, or Stripe). */
export class OrderChangedError extends Error {
  constructor(readonly current: OrderStatus) {
    super(`The order is now "${current}"`);
    this.name = "OrderChangedError";
  }
}

export type TransitionOptions = {
  note?: string;
  /** Required when moving to "shipped". */
  shipment?: { courier: string; trackingNumber: string };
  /** The status the admin saw. If the order has moved on since, nothing changes. */
  expectedFrom?: OrderStatus;
  /** When cancelling: put ready-made pieces back in stock. */
  restock?: boolean;
  /** Set for admin changes: also writes admin_log, in the same transaction. */
  admin?: AdminActor;
};

export type TransitionResult = { from: OrderStatus; to: OrderStatus; restocked: number };

/**
 * Moves an order to a new status if the rules allow it, and records the change in
 * order_events (and admin_log for admin changes). The only way statuses change (rule 3).
 * Emails are the caller's job, after this returns (rule 4).
 */
export async function transitionOrder(
  orderId: string,
  to: OrderStatus,
  actor: string,
  options: TransitionOptions = {},
): Promise<TransitionResult> {
  const { shipment, expectedFrom, admin } = options;
  if (to === "shipped" && !shipment) {
    throw new Error("Marking an order as shipped needs the courier and tracking number");
  }

  try {
    return await getDb().$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        select: {
          status: true,
          courier: true,
          trackingNumber: true,
          items: { select: { isCustom: true, variantId: true, quantity: true } },
        },
      });
      if (expectedFrom && order.status !== expectedFrom) throw new OrderChangedError(order.status);
      const hasCustomItems = order.items.some((item) => item.isCustom);
      if (!canTransition(order.status, to, { hasCustomItems })) {
        throw new InvalidTransitionError(order.status, to);
      }

      // Matching on the old status stops two simultaneous changes from both succeeding.
      await tx.order.update({
        where: { id: orderId, status: order.status },
        data: {
          status: to,
          [statusTimestampField[to]]: new Date(),
          ...(shipment
            ? { courier: shipment.courier, trackingNumber: shipment.trackingNumber }
            : {}),
        },
      });

      // Ready-made pieces go back on sale; custom-fit pieces and made-to-order sizes don't.
      let restocked = 0;
      if (to === "cancelled" && options.restock) {
        for (const item of order.items) {
          if (item.isCustom || !item.variantId) continue;
          restocked += await tx.$executeRaw`
            UPDATE variants SET stock = stock + ${item.quantity}
            WHERE id = ${item.variantId}::uuid AND stock IS NOT NULL`;
        }
      }

      const details = [
        shipment ? `${courierName(shipment.courier)} ${shipment.trackingNumber}` : null,
        restocked > 0 ? "Ready-made pieces put back in stock" : null,
        options.note ?? null,
      ].filter(Boolean);
      await tx.orderEvent.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: to,
          actor,
          note: details.length > 0 ? details.join(" · ") : null,
        },
      });

      if (admin) {
        await writeAdminLog(tx, admin, {
          action: "order.status",
          entity: "order",
          entityId: orderId,
          before: {
            status: order.status,
            courier: order.courier,
            trackingNumber: order.trackingNumber,
          },
          after: {
            status: to,
            courier: shipment?.courier ?? order.courier,
            trackingNumber: shipment?.trackingNumber ?? order.trackingNumber,
            ...(to === "cancelled" ? { restockedLines: restocked } : {}),
            ...(options.note ? { note: options.note } : {}),
          },
        });
      }
      return { from: order.status, to, restocked };
    });
  } catch (error) {
    // The order changed between our read and our update (a simultaneous change won).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      const now = await getDb().order.findUnique({
        where: { id: orderId },
        select: { status: true },
      });
      if (now) throw new OrderChangedError(now.status);
    }
    throw error;
  }
}

/** Records on the order's history that an admin sent the confirmation email again. */
export async function recordConfirmationResent(orderId: string, admin: AdminActor) {
  await getDb().$transaction(async (tx) => {
    await tx.orderEvent.create({
      data: { orderId, actor: admin.adminId, note: "Confirmation email sent again" },
    });
    await writeAdminLog(tx, admin, {
      action: "order.resend_confirmation",
      entity: "order",
      entityId: orderId,
    });
  });
}

/**
 * The admin saw the customer's fit call booked in Cal.com: the order stops waiting for it and
 * gets no reminder. Returns false if it was already marked or has no custom-fit pieces.
 */
export async function markFitCallBooked(orderId: string, admin: AdminActor): Promise<boolean> {
  return getDb().$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id: orderId, fitCallBookedAt: null, items: { some: { isCustom: true } } },
      data: { fitCallBookedAt: new Date() },
    });
    if (count === 0) return false;
    await tx.orderEvent.create({
      data: { orderId, actor: admin.adminId, note: "Fit call booked" },
    });
    await writeAdminLog(tx, admin, {
      action: "order.fit_call_booked",
      entity: "order",
      entityId: orderId,
      before: { fitCallBooked: false },
      after: { fitCallBooked: true },
    });
    return true;
  });
}

/** Measurements can be corrected until the order ships (usually right after the fit call). */
export const MEASUREMENT_EDIT_STATUSES: readonly OrderStatus[] = [
  "paid",
  "confirmed",
  "in_production",
];

export class MeasurementsLockedError extends Error {
  constructor() {
    super("The order has moved past the point where measurements can change");
    this.name = "MeasurementsLockedError";
  }
}

/** One custom-fit piece's measurements as admin_log fields: "1. Bust": "36 in", ... */
function measurementLogFields(piece: string, raw: unknown): Prisma.InputJsonObject {
  const display = describeMeasurements(raw);
  return {
    piece,
    ...Object.fromEntries((display?.rows ?? []).map((row) => [row.label, row.value])),
    ...(display?.notes ? { note: display.notes } : {}),
  };
}

/**
 * The admin corrects a custom-fit piece's measurements (after the fit call). Checked like the
 * customer's form, saved on the order item, and logged with before and after.
 */
export async function updateItemMeasurements(
  orderId: string,
  itemId: string,
  rawSet: MeasurementSet,
  admin: AdminActor,
): Promise<void> {
  const set = measurementSetSchema.parse(rawSet);
  await getDb().$transaction(async (tx) => {
    const item = await tx.orderItem.findFirst({
      where: { id: itemId, orderId, isCustom: true },
      select: { titleSnapshot: true, measurements: true, order: { select: { status: true } } },
    });
    if (!item) throw new Error(`Custom-fit item ${itemId} not found on order ${orderId}`);
    if (!MEASUREMENT_EDIT_STATUSES.includes(item.order.status)) throw new MeasurementsLockedError();
    await tx.orderItem.update({
      where: { id: itemId },
      data: { measurements: set as Prisma.InputJsonObject },
    });
    await tx.orderEvent.create({
      data: { orderId, actor: admin.adminId, note: `Measurements changed: ${item.titleSnapshot}` },
    });
    await writeAdminLog(tx, admin, {
      action: "order.measurements",
      entity: "order",
      entityId: orderId,
      before: measurementLogFields(item.titleSnapshot, item.measurements),
      after: measurementLogFields(item.titleSnapshot, set),
    });
  });
}

/** An internal note from the admin on the order's history (not shown to the customer). */
export async function addOrderNote(orderId: string, note: string, admin: AdminActor) {
  await getDb().$transaction(async (tx) => {
    await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { id: true } });
    await tx.orderEvent.create({ data: { orderId, actor: admin.adminId, note } });
    await writeAdminLog(tx, admin, {
      action: "order.note",
      entity: "order",
      entityId: orderId,
      after: { note },
    });
  });
}

export type RefundResult =
  | { status: "refunded"; orderId: string; amountCents: number }
  | { status: "partial"; orderId: string; amountCents: number }
  | { status: "skipped"; reason: string };

/** Applies a refund made in Stripe's dashboard to the matching order. Safe to repeat. */
export async function applyChargeRefund(
  charge: Stripe.Charge,
  eventId: string,
): Promise<RefundResult> {
  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) return { status: "skipped", reason: "charge has no payment intent" };

  const db = getDb();
  const order = await db.order.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
    select: { id: true, status: true },
  });
  if (!order) return { status: "skipped", reason: `no order for ${paymentIntentId}` };

  if (charge.refunded) {
    if (order.status === "refunded") return { status: "skipped", reason: "already refunded" };
    await transitionOrder(order.id, "refunded", "stripe", {
      note: `Refunded ${formatCents(charge.amount_refunded)} in Stripe`,
    });
    return { status: "refunded", orderId: order.id, amountCents: charge.amount_refunded };
  }

  // Partial refund (e.g. an alteration payment): a note only. The event id stops duplicates.
  const marker = `[${eventId}]`;
  const seen = await db.orderEvent.findFirst({
    where: { orderId: order.id, note: { contains: marker } },
    select: { id: true },
  });
  if (!seen) {
    await db.orderEvent.create({
      data: {
        orderId: order.id,
        actor: "stripe",
        note: `Partial refund in Stripe: ${formatCents(charge.amount_refunded)} refunded so far ${marker}`,
      },
    });
  }
  return { status: "partial", orderId: order.id, amountCents: charge.amount_refunded };
}
