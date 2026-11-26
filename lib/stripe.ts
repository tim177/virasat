import "server-only";

import Stripe from "stripe";

// Stripe client for the server. Card data never reaches us: customers pay on Stripe's hosted
// Checkout page, and Stripe tells us about payments through signed webhooks.

let client: Stripe | undefined;

export function getStripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set. See .env.example.");
    client = new Stripe(key, { maxNetworkRetries: 2, appInfo: { name: "Virasat" } });
  }
  return client;
}

export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set. See .env.example.");
  return secret;
}
