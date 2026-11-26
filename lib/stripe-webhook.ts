import "server-only";

import type Stripe from "stripe";

import { applyChargeRefund, createOrderFromSession } from "@/lib/orders";
import { getStripe, getWebhookSecret } from "@/lib/stripe";

// Stripe webhook logic, separate from the route so integration tests can run it directly.
// The route (app/api/stripe/webhook) verifies, calls handleStripeEvent, then replies 200.

export class InvalidSignatureError extends Error {
  constructor() {
    super("Invalid Stripe signature");
    this.name = "InvalidSignatureError";
  }
}

/** Proves the request really came from Stripe and wasn't changed on the way. */
export function verifyStripeEvent(rawBody: string, signature: string | null): Stripe.Event {
  if (!signature) throw new InvalidSignatureError();
  try {
    return getStripe().webhooks.constructEvent(rawBody, signature, getWebhookSecret());
  } catch {
    throw new InvalidSignatureError();
  }
}

/** Side effects that run only after the database change is saved (emails, cache refresh). */
export type WebhookEffects = {
  orderCreated: (orderId: string) => void;
  orderRefunded: (orderId: string, amountCents: number) => void;
};

export type HandledEvent = { type: string; outcome: string };

export async function handleStripeEvent(
  event: Stripe.Event,
  effects: WebhookEffects,
): Promise<HandledEvent> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const result = await createOrderFromSession(event.data.object);
      if (result.status === "created") effects.orderCreated(result.orderId);
      if (result.status === "skipped") console.warn(`Stripe ${event.id}: ${result.reason}`);
      return { type: event.type, outcome: result.status };
    }
    case "charge.refunded": {
      const result = await applyChargeRefund(event.data.object, event.id);
      if (result.status === "refunded") effects.orderRefunded(result.orderId, result.amountCents);
      return { type: event.type, outcome: result.status };
    }
    default:
      return { type: event.type, outcome: "ignored" };
  }
}
