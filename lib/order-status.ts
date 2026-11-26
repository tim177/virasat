import type { OrderStatus } from "@/lib/generated/prisma/enums";

// The one place that decides which order status changes are allowed (v1 spec, section 7).
//
//   paid → confirmed → in_production → shipped → delivered
//   paid / confirmed → cancelled; in_production → cancelled only without custom-fit items
//   Full refund in Stripe → refunded, from any status except refunded

const forward: Record<OrderStatus, OrderStatus[]> = {
  paid: ["confirmed", "cancelled"],
  confirmed: ["in_production", "cancelled"],
  in_production: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
  refunded: [],
};

export type TransitionContext = { hasCustomItems: boolean };

export function canTransition(from: OrderStatus, to: OrderStatus, ctx: TransitionContext): boolean {
  if (to === "refunded") return from !== "refunded";
  if (from === "in_production" && to === "cancelled" && ctx.hasCustomItems) return false;
  return forward[from].includes(to);
}

/** Statuses an order can move to next (for admin buttons in Step 6). */
export function nextStatuses(from: OrderStatus, ctx: TransitionContext): OrderStatus[] {
  const all: OrderStatus[] = [...forward[from], "refunded"];
  return [...new Set(all)].filter((to) => canTransition(from, to, ctx));
}

/**
 * The status buttons the admin sees. Refunds are made in Stripe's dashboard (the webhook
 * then moves the order to refunded), so there is no "refunded" button.
 */
export function adminNextStatuses(from: OrderStatus, ctx: TransitionContext): OrderStatus[] {
  return nextStatuses(from, ctx).filter((to) => to !== "refunded");
}

/** Statuses that send the customer an email when an order enters them (lib/order-emails). */
export const STATUSES_WITH_EMAIL = [
  "shipped",
  "delivered",
  "cancelled",
] as const satisfies readonly OrderStatus[];

export function sendsStatusEmail(status: OrderStatus): boolean {
  return (STATUSES_WITH_EMAIL as readonly OrderStatus[]).includes(status);
}

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: OrderStatus,
    readonly to: OrderStatus,
  ) {
    super(`An order can't go from "${from}" to "${to}"`);
    this.name = "InvalidTransitionError";
  }
}

/** Timestamp column to set when an order enters a status. */
export const statusTimestampField = {
  paid: "paidAt",
  confirmed: "confirmedAt",
  in_production: "inProductionAt",
  shipped: "shippedAt",
  delivered: "deliveredAt",
  cancelled: "cancelledAt",
  refunded: "refundedAt",
} as const satisfies Record<OrderStatus, string>;
