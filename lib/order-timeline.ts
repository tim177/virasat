import type { OrderStatus } from "@/lib/generated/prisma/enums";

// The order timeline customers see: the usual steps from paid to delivered, with the date each
// was reached. Built only from status changes (order_events.to_status), never from notes.

const FLOW = ["paid", "confirmed", "in_production", "shipped", "delivered"] as const;
type FlowStatus = (typeof FLOW)[number];

export type CustomerTimelineStep = {
  status: OrderStatus;
  state: "complete" | "current" | "upcoming";
  date: Date | null;
};

export function customerTimeline(
  status: OrderStatus,
  events: Array<{ toStatus: OrderStatus | null; createdAt: Date }>,
): CustomerTimelineStep[] {
  const reachedAt = new Map<OrderStatus, Date>();
  for (const event of [...events].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    if (event.toStatus && !reachedAt.has(event.toStatus)) {
      reachedAt.set(event.toStatus, event.createdAt);
    }
  }
  const date = (s: OrderStatus) => reachedAt.get(s) ?? null;

  const position = FLOW.indexOf(status as FlowStatus);
  if (position >= 0) {
    // Done up to the current status; the next step is the one in progress.
    return FLOW.map((step, index) => ({
      status: step,
      state: index <= position ? "complete" : index === position + 1 ? "current" : "upcoming",
      date: index <= position ? date(step) : null,
    }));
  }

  // Cancelled or refunded: the steps it got through, then how it ended.
  const reached = FLOW.filter((step) => step === "paid" || reachedAt.has(step));
  const endings = (["cancelled", "refunded"] as const).filter(
    (end) => end === status || reachedAt.has(end),
  );
  return [...reached, ...endings].map((step) => ({
    status: step,
    state: "complete",
    date: date(step),
  }));
}
