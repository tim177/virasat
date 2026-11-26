import "server-only";

import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { z } from "zod";

import {
  AdminNewOrderEmail,
  OrderConfirmationEmail,
  RefundEmail,
  type EmailOrder,
} from "@/emails/order-emails";
import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email/send";
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

async function loadEmailOrder(
  orderId: string,
): Promise<EmailOrder & { confirmationSentAt: Date | null; adminAlertSentAt: Date | null }> {
  const order = await getDb().order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      number: true,
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

async function sendConfirmation(orderId: string): Promise<void> {
  const order = await loadEmailOrder(orderId);
  if (order.confirmationSentAt) return;
  const { html, text } = await renderEmail(<OrderConfirmationEmail order={order} />);
  await sendEmail({
    to: order.email,
    subject: en.email.confirmationSubject(order.number),
    html,
    text,
    tag: "order-confirmation",
  });
  await getDb().order.updateMany({
    where: { id: orderId, confirmationSentAt: null },
    data: { confirmationSentAt: new Date() },
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

/** Cron job: sends confirmations and admin alerts that failed earlier. */
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
  return { attempted: orders.length };
}
