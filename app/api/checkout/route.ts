import { bagRequestSchema } from "@/lib/bag-schema";
import { CheckoutProblemError, createCheckout } from "@/lib/checkout";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

// Starts payment: prices the bag on the server, saves a draft and returns Stripe's page URL.
export async function POST(request: Request) {
  if (!rateLimit(`checkout:${clientIp(request)}`, 10, 60_000)) return tooManyRequests();

  const body = bagRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "invalid_bag" }, { status: 400 });

  try {
    const { url } = await createCheckout(body.data.lines);
    return Response.json({ url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof CheckoutProblemError) {
      return Response.json({ error: "bag_changed", bag: error.bag }, { status: 409 });
    }
    console.error("Checkout failed", error);
    return Response.json({ error: "checkout_failed" }, { status: 500 });
  }
}
