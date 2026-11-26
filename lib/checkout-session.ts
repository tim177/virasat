import type Stripe from "stripe";

import type { DraftLine } from "@/lib/draft-schema";

// Builds the Stripe Checkout Session request. Pure, so it can be unit-tested.
// Amounts come only from our server-priced draft lines, in integer cents.

export function checkoutLineName(line: Pick<DraftLine, "title" | "size" | "isCustom">): string {
  return line.isCustom ? `${line.title} (custom fit)` : `${line.title} (${line.size})`;
}

export function buildCheckoutSessionParams(
  draftId: string,
  lines: DraftLine[],
  siteUrl: string,
): Stripe.Checkout.SessionCreateParams {
  // Stripe can only show photos it can download, so local development sends none.
  const publicPhotos = siteUrl.startsWith("https://");

  return {
    mode: "payment",
    locale: "en",
    // Prices are all-inclusive US dollars. Stripe's Adaptive Pricing would otherwise offer
    // shoppers abroad (or on a VPN) their local currency plus a conversion fee.
    adaptive_pricing: { enabled: false },
    line_items: lines.map((line) => ({
      quantity: line.quantity,
      price_data: {
        currency: "usd",
        unit_amount: line.unitPriceCents,
        product_data: {
          name: checkoutLineName(line),
          ...(publicPhotos && line.imageUrl
            ? { images: [new URL(line.imageUrl, siteUrl).toString()] }
            : {}),
          metadata: { product_slug: line.productSlug },
        },
      },
    })),
    shipping_address_collection: { allowed_countries: ["US"] },
    phone_number_collection: { enabled: true },
    allow_promotion_codes: true,
    success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/bag`,
    metadata: { draft_id: draftId },
    payment_intent_data: { metadata: { draft_id: draftId } },
  };
}
