import "server-only";

import { getDb } from "@/lib/db";

/** The order for a Stripe Checkout Session, for the "Order confirmed" page. Never cached. */
export async function getOrderBySession(stripeSessionId: string) {
  return getDb().order.findUnique({
    where: { stripeSessionId },
    select: {
      number: true,
      status: true,
      customerName: true,
      email: true,
      shippingAddress: true,
      subtotalCents: true,
      discountCents: true,
      shippingCents: true,
      totalCents: true,
      paidAt: true,
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          titleSnapshot: true,
          imageSnapshot: true,
          size: true,
          isCustom: true,
          quantity: true,
          unitPriceCents: true,
        },
      },
    },
  });
}

/** "priya@example.com" → "pr***@example.com": enough to recognise, not enough to harvest. */
export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  return `${name.slice(0, 2)}***@${domain}`;
}
