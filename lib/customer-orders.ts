import "server-only";

import { timingSafeEqual } from "node:crypto";

import type { Customer } from "@/lib/customer-auth";
import { getDb } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

// Orders as customers see them: in their account, or from the link in their emails. Only status
// changes are read from order_events; internal notes never leave the admin.

/**
 * A customer's orders: those placed while signed in, plus every order with their email address
 * once it's verified (email code or Google), so guest orders from before the account show too.
 */
function ownedBy(customer: Customer): Prisma.OrderWhereInput {
  return {
    OR: [
      { userId: customer.id },
      ...(customer.emailVerified
        ? [{ email: { equals: customer.email, mode: "insensitive" as const } }]
        : []),
    ],
  };
}

const detailSelect = {
  id: true,
  number: true,
  status: true,
  email: true,
  customerName: true,
  shippingAddress: true,
  subtotalCents: true,
  discountCents: true,
  shippingCents: true,
  totalCents: true,
  courier: true,
  trackingNumber: true,
  paidAt: true,
  fitCallBookedAt: true,
  items: {
    orderBy: { id: "asc" },
    select: {
      id: true,
      titleSnapshot: true,
      imageSnapshot: true,
      size: true,
      isCustom: true,
      measurements: true,
      unitPriceCents: true,
      quantity: true,
    },
  },
  events: {
    where: { toStatus: { not: null } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    // Status and time only: never the note or who made the change.
    select: { toStatus: true, createdAt: true },
  },
} satisfies Prisma.OrderSelect;

export type CustomerOrder = Prisma.OrderGetPayload<{ select: typeof detailSelect }>;

export async function listCustomerOrders(customer: Customer) {
  const orders = await getDb().order.findMany({
    where: ownedBy(customer),
    orderBy: { paidAt: "desc" },
    take: 100,
    select: {
      number: true,
      status: true,
      totalCents: true,
      paidAt: true,
      items: { select: { quantity: true, isCustom: true } },
    },
  });
  return orders.map((order) => ({
    number: order.number,
    status: order.status,
    totalCents: order.totalCents,
    paidAt: order.paidAt,
    pieces: order.items.reduce((sum, item) => sum + item.quantity, 0),
    hasCustom: order.items.some((item) => item.isCustom),
  }));
}

export type CustomerOrderSummary = Awaited<ReturnType<typeof listCustomerOrders>>[number];

/** One of this customer's orders, or null (also when it belongs to someone else). */
export async function getCustomerOrder(
  customer: Customer,
  number: string,
): Promise<CustomerOrder | null> {
  return getDb().order.findFirst({
    where: { AND: [{ number }, ownedBy(customer)] },
    select: detailSelect,
  });
}

function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** The order behind an email link (/orders/VRS-1001?t=...), or null if the link is wrong. */
export async function getOrderByToken(
  number: string,
  token: string,
): Promise<CustomerOrder | null> {
  const order = await getDb().order.findUnique({
    where: { number },
    select: { ...detailSelect, accessToken: true },
  });
  if (!order) return null;
  const { accessToken, ...visible } = order;
  return sameSecret(accessToken, token) ? visible : null;
}
