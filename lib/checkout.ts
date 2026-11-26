import "server-only";

import type Stripe from "stripe";

import type { BagLine } from "@/lib/bag-schema";
import { buildCheckoutSessionParams } from "@/lib/checkout-session";
import { getDb } from "@/lib/db";
import type { DraftLine } from "@/lib/draft-schema";
import type { Prisma } from "@/lib/generated/prisma/client";
import { priceBag, type PricedBag, type PricingProduct } from "@/lib/pricing";
import { siteUrl } from "@/lib/site-url";
import { getStripe } from "@/lib/stripe";

/** Loads the products a bag refers to, including unpublished ones (so we can say why). */
async function loadPricingProducts(slugs: string[]): Promise<Map<string, PricingProduct>> {
  const rows = await getDb().product.findMany({
    where: { slug: { in: [...new Set(slugs)] } },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      priceCents: true,
      customFitAvailable: true,
      customFitExtraCents: true,
      readyDays: true,
      customDays: true,
      images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
      variants: { select: { id: true, size: true, stock: true } },
    },
  });
  return new Map(
    rows.map((row) => [
      row.slug,
      {
        id: row.id,
        slug: row.slug,
        title: row.title,
        published: row.status === "published",
        priceCents: row.priceCents,
        customFitAvailable: row.customFitAvailable,
        customFitExtraCents: row.customFitExtraCents,
        readyDays: row.readyDays,
        customDays: row.customDays,
        imageUrl: row.images[0]?.url ?? null,
        variants: row.variants,
      },
    ]),
  );
}

/** Current prices and availability for a bag (bag page). */
export async function quoteBag(lines: BagLine[]): Promise<PricedBag> {
  return priceBag(lines, await loadPricingProducts(lines.map((line) => line.productSlug)));
}

/** The bag can't be bought as-is (price, stock or availability changed). */
export class CheckoutProblemError extends Error {
  constructor(readonly bag: PricedBag) {
    super("The bag has changed");
    this.name = "CheckoutProblemError";
  }
}

type CreateSession = (
  params: Stripe.Checkout.SessionCreateParams,
  options: Stripe.RequestOptions,
) => Promise<Pick<Stripe.Checkout.Session, "id" | "url">>;

const stripeCreateSession: CreateSession = (params, options) =>
  getStripe().checkout.sessions.create(params, options);

/**
 * Prices the bag on the server, saves it as a draft and opens a Stripe Checkout Session.
 * `createSession` can be replaced in tests so they don't call Stripe.
 */
export async function createCheckout(
  lines: BagLine[],
  createSession: CreateSession = stripeCreateSession,
): Promise<{ url: string; draftId: string; sessionId: string }> {
  const bag = await quoteBag(lines);
  if (!bag.ok || bag.lines.length === 0) throw new CheckoutProblemError(bag);

  const draftLines: DraftLine[] = bag.lines.map((line) => ({
    productId: line.productId as string,
    variantId: line.variantId,
    productSlug: line.productSlug,
    title: line.title,
    size: line.size,
    isCustom: line.isCustom,
    quantity: line.quantity,
    unitPriceCents: line.unitPriceCents,
    productionDays: line.productionDays,
    imageUrl: line.imageUrl,
    measurements: null,
  }));

  const db = getDb();
  const draft = await db.checkoutDraft.create({
    // Zod-validated plain data, so it is valid JSON for Prisma.
    data: { items: draftLines as Prisma.InputJsonArray, subtotalCents: bag.subtotalCents },
    select: { id: true },
  });

  // The idempotency key means a retried request never opens a second session for this draft.
  const session = await createSession(buildCheckoutSessionParams(draft.id, draftLines, siteUrl), {
    idempotencyKey: `checkout-draft-${draft.id}`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");

  await db.checkoutDraft.update({ where: { id: draft.id }, data: { stripeSessionId: session.id } });
  return { url: session.url, draftId: draft.id, sessionId: session.id };
}

/**
 * How long a draft is kept. Stripe Checkout Sessions expire within 24 hours and only instant
 * payment methods are on, so a week leaves plenty of room for late webhook retries.
 */
export const DRAFT_MAX_AGE_DAYS = 7;

/** Deletes drafts older than DRAFT_MAX_AGE_DAYS (daily cron job). Orders don't depend on them. */
export async function deleteOldDrafts(now: Date = new Date()): Promise<{ deleted: number }> {
  const cutoff = new Date(now.getTime() - DRAFT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await getDb().checkoutDraft.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return { deleted: count };
}
