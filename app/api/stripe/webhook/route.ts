import { after } from "next/server";

import { refreshShop } from "@/lib/cache-refresh";
import { sendNewOrderEmails, sendRefundEmail } from "@/lib/order-emails";
import { handleStripeEvent, InvalidSignatureError, verifyStripeEvent } from "@/lib/stripe-webhook";

// Stripe calls this after a payment or refund. The steps:
//   1. Check Stripe's signature (rejects anything not from Stripe).
//   2. Create the order once / record the refund (lib/orders.ts).
//   3. Reply 200. Emails are sent right after the reply (`after`), so a slow email never
//      delays Stripe, and a failed one is retried by the cron job.
// Any error replies 500 and Stripe retries; repeats are safe because orders are unique per
// Checkout Session.
export async function POST(request: Request) {
  let event;
  try {
    event = verifyStripeEvent(await request.text(), request.headers.get("stripe-signature"));
  } catch (error) {
    if (error instanceof InvalidSignatureError) {
      return Response.json({ error: "invalid_signature" }, { status: 400 });
    }
    throw error;
  }

  try {
    const result = await handleStripeEvent(event, {
      orderCreated: (orderId) => {
        refreshShop(); // stock changed
        after(() => sendNewOrderEmails(orderId));
      },
      orderRefunded: (orderId, amountCents) => {
        after(() => sendRefundEmail(orderId, amountCents));
      },
    });
    return Response.json({ received: true, ...result });
  } catch (error) {
    console.error(`Stripe webhook ${event.id} (${event.type}) failed`, error);
    return Response.json({ error: "handler_failed" }, { status: 500 });
  }
}
