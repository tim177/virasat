import { StatusPill, type BadgeTone } from "@/components/ui/badge";
import type { OrderStatus } from "@/lib/generated/prisma/enums";
import { en } from "@/lib/i18n/en";

// "Paid" stands out because it waits for the admin; finished orders are quiet.
const tones: Record<OrderStatus, BadgeTone> = {
  paid: "accent",
  confirmed: "info",
  in_production: "info",
  shipped: "info",
  delivered: "success",
  cancelled: "neutral",
  refunded: "neutral",
};

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  return <StatusPill tone={tones[status]} label={en.orderStatus[status]} />;
}
