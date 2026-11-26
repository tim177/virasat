import "server-only";

import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { z } from "zod";

import {
  AdminNewOrderEmail,
  OrderCancelledEmail,
  OrderConfirmationEmail,
  OrderDeliveredEmail,
  OrderShippedEmail,
  RefundEmail,
  type EmailOrder,
} from "@/emails/order-emails";
import { courierName, trackingUrl } from "@/lib/couriers";
import { getDb } from "@/lib/db";
import { SHIPPING_BUSINESS_DAYS } from "@/lib/delivery";
import { sendEmail } from "@/lib/email/send";
import type { OrderStatus, Prisma } from "@/lib/generated/prisma/client";
import { en } from "@/lib/i18n/en";
import { formatCents } from "@/lib/money";

// Order emails. They run after the order is saved and never throw: a failed email is logged,
// left unmarked, and retried by the cron job (/api/cron/emails). CLAUDE.md rule 4.

const addressSchema = z.object({
  line1: z.string(),
  line2: z.string().nullable(),
  city: z.string(),
  state: z.string().nullable(),
  postalCode: z.string(),
  country: z.string(),
});

type LoadedEmailOrder = EmailOrder & {
  status: OrderStatus;
  courier: string | null;
  trackingNumber: string | null;
  confirmationSentAt: Date | null;
  adminAlertSentAt: Date | null;
  statusEmailSentFor: OrderStatus | null;
};

async function loadEmailOrder(orderId: string): Promise<LoadedEmailOrder> {
  const order = await getDb().order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      number: true,
      status: true,
      courier: true,
      trackingNumber: true,
      statusEmailSentFor: true,
      customerName: true,
      email: true,
      shippingAddress: true,
      subtotalCents: true,
      discountCents: true,
      shippingCents: true,
      totalCents: true,
      confirmationSentAt: true,
      adminAlertSentAt: true,
      items: {
        orderBy: { id: "asc" },
        select: {
          titleSnapshot: true,
          size: true,
          isCustom: true,
          quantity: true,
          unitPriceCents: true,
        },
      },
    },
  });
  return {
    ...order,
    shippingAddress: addressSchema.parse(order.shippingAddress),
    items: order.items.map((item) => ({
      title: item.titleSnapshot,
      size: item.size,
      isCustom: item.isCustom,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
    })),
  };
}

async function renderEmail(element: ReactElement) {
  const html = await render(element);
  const text = await render(element, { plainText: true });
  return { html, text };
}

async function sendConfirmation(orderId: string, { again = false } = {}): Promise<void> {
  const order = await loadEmailOrder(orderId);
  if (order.confirmationSentAt && !again) return;
  const { html, text } = await renderEmail(<OrderConfirmationEmail order={order} />);
  await sendEmail({
    to: order.email,
    subject: en.email.confirmationSubject(order.number),
    html,
    text,
    tag: "order-confirmation",
  });
  await getDb().order.updateMany({
    where: { id: orderId, ...(again ? {} : { confirmationSentAt: null }) },
    data: { confirmationSentAt: new Date() },
  });
}

/** Admin's "Resend confirmation email". Throws if sending fails, so the admin is told. */
export async function resendConfirmation(orderId: string): Promise<void> {
  await sendConfirmation(orderId, { again: true });
}

function statusEmail(order: LoadedEmailOrder) {
  switch (order.status) {
    case "shipped": {
      const courier = order.courier ?? "";
      const trackingNumber = order.trackingNumber ?? "";
      return {
        subject: en.email.shippedSubject(order.number),
        element: (
          <OrderShippedEmail
            order={order}
            courier={courierName(courier)}
            trackingNumber={trackingNumber}
            trackingUrl={trackingUrl(courier, trackingNumber)}
            shippingDays={SHIPPING_BUSINESS_DAYS}
          />
        ),
      };
    }
    case "delivered":
      return {
        subject: en.email.deliveredSubject(order.number),
        element: <OrderDeliveredEmail order={order} />,
      };
    case "cancelled":
      return {
        subject: en.email.cancelledSubject(order.number),
        element: <OrderCancelledEmail order={order} />,
      };
    default:
      return null;
  }
}

/**
 * The customer email for the order's current status (shipped, delivered or cancelled), sent
 * once per status. Never throws; a failure is retried by the cron job.
 */
export async function sendStatusEmail(orderId: string): Promise<boolean> {
  return safely(`status email for ${orderId}`, async () => {
    const order = await loadEmailOrder(orderId);
    if (order.statusEmailSentFor === order.status) return;
    const email = statusEmail(order);
    if (!email) return;
    const { html, text } = await renderEmail(email.element);
    await sendEmail({
      to: order.email,
      subject: email.subject,
      html,
      text,
      tag: `order-${order.status}`,
    });
    // Only if the status hasn't changed meanwhile; otherwise the next status gets its email.
    await getDb().order.updateMany({
      where: { id: orderId, status: order.status },
      data: { statusEmailSentFor: order.status },
    });
  });
}

async function sendAdminAlert(orderId: string): Promise<void> {
  const to = process.env.ADMIN_ALERT_EMAIL;
  if (!to) return;
  const order = await loadEmailOrder(orderId);
  if (order.adminAlertSentAt) return;
  const { html, text } = await renderEmail(<AdminNewOrderEmail order={order} />);
  await sendEmail({
    to,
    subject: en.email.adminSubject(order.number, formatCents(order.totalCents)),
    html,
    text,
    tag: "admin-new-order",
  });
  await getDb().order.updateMany({
    where: { id: orderId, adminAlertSentAt: null },
    data: { adminAlertSentAt: new Date() },
  });
}

async function safely(label: string, task: () => Promise<void>): Promise<boolean> {
  try {
    await task();
    return true;
  } catch (error) {
    console.error(`[email] ${label} failed`, error);
    return false;
  }
}

/** Customer confirmation + admin alert for a new order. Never throws. */
export async function sendNewOrderEmails(orderId: string): Promise<void> {
  await Promise.all([
    safely(`confirmation for ${orderId}`, () => sendConfirmation(orderId)),
    safely(`admin alert for ${orderId}`, () => sendAdminAlert(orderId)),
  ]);
}

/** Tells the customer about a full refund. Never throws; a failure is noted on the order. */
export async function sendRefundEmail(orderId: string, amountCents: number): Promise<void> {
  const ok = await safely(`refund email for ${orderId}`, async () => {
    const order = await loadEmailOrder(orderId);
    const { html, text } = await renderEmail(
      <RefundEmail order={order} amountCents={amountCents} />,
    );
    await sendEmail({
      to: order.email,
      subject: en.email.refundSubject(order.number),
      html,
      text,
      tag: "refund",
    });
  });
  if (!ok) {
    await getDb()
      .orderEvent.create({
        data: {
          orderId,
          actor: "system",
          note: "The refund email could not be sent. Email the customer.",
        },
      })
      .catch(() => undefined);
  }
}

/** Cron job: sends confirmations, admin alerts and status emails that failed earlier. */
export async function retryUnsentEmails(): Promise<{ attempted: number }> {
  const olderThan = new Date(Date.now() - 2 * 60 * 1000);
  const orders = await getDb().order.findMany({
    where: {
      paidAt: { lt: olderThan },
      OR: [
        { confirmationSentAt: null },
        ...(process.env.ADMIN_ALERT_EMAIL ? [{ adminAlertSentAt: null }] : []),
      ],
    },
    select: { id: true },
    take: 50,
    orderBy: { paidAt: "asc" },
  });
  for (const order of orders) await sendNewOrderEmails(order.id);

  // Shipped, delivered and cancelled emails that failed. Only for changes in the last 3 days,
  // so an old order never gets a surprise email.
  const changed = { lt: olderThan, gt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) };
  const unsent = (status: OrderStatus): Prisma.OrderWhereInput => ({
    status,
    OR: [{ statusEmailSentFor: null }, { statusEmailSentFor: { not: status } }],
  });
  const statusOrders = await getDb().order.findMany({
    where: {
      OR: [
        { ...unsent("shipped"), shippedAt: changed },
        { ...unsent("delivered"), deliveredAt: changed },
        { ...unsent("cancelled"), cancelledAt: changed },
      ],
    },
    select: { id: true },
    take: 50,
    orderBy: { updatedAt: "asc" },
  });
  for (const order of statusOrders) await sendStatusEmail(order.id);

  return { attempted: orders.length + statusOrders.length };
}
