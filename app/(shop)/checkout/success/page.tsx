import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";

import { AwaitingOrder } from "@/components/checkout/awaiting-order";
import { OrderPlacedEffects } from "@/components/checkout/order-placed-effects";
import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/ui/empty-state";
import { ZariRule } from "@/components/ui/ornament";
import { Price } from "@/components/ui/price";
import { Timeline } from "@/components/ui/progress";
import { StaticImage } from "@/components/ui/static-image";
import { en } from "@/lib/i18n/en";
import { formatCents } from "@/lib/money";
import { getOrderBySession, maskEmail } from "@/lib/order-queries";

export const metadata: Metadata = {
  title: en.checkout.metaTitle,
  robots: { index: false, follow: false },
};

const t = en.checkout;
const sessionIdSchema = z.string().regex(/^cs_(test|live)_[A-Za-z0-9]{10,200}$/);

/** Stripe sends customers here after paying. This page only reads the order (CLAUDE.md rule 2). */
export default function CheckoutSuccessPage({ searchParams }: PageProps<"/checkout/success">) {
  return (
    <div className="page-container flex flex-1 flex-col py-8 md:py-12">
      <Suspense fallback={<AwaitingOrder />}>
        <Confirmation searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Confirmation({
  searchParams,
}: {
  searchParams: PageProps<"/checkout/success">["searchParams"];
}) {
  const raw = (await searchParams).session_id;
  const sessionId = sessionIdSchema.safeParse(Array.isArray(raw) ? raw[0] : raw);
  if (!sessionId.success) {
    return (
      <EmptyState
        headingLevel={2}
        title={t.notFoundTitle}
        description={t.notFoundText}
        action={<ButtonLink href="/bag">{t.backToBag}</ButtonLink>}
      />
    );
  }

  await connection();
  const order = await getOrderBySession(sessionId.data);
  if (!order) return <AwaitingOrder />;

  const firstName = order.customerName.trim().split(/\s+/)[0] || order.customerName;
  const hasCustom = order.items.some((item) => item.isCustom);
  const address = order.shippingAddress as {
    line1: string;
    line2: string | null;
    city: string;
    state: string | null;
    postalCode: string;
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <OrderPlacedEffects orderNumber={order.number} totalCents={order.totalCents} />

      <header className="flex flex-col items-center gap-4 text-center">
        <h1 className="font-display text-h1">{t.confirmedTitle(firstName)}</h1>
        <ZariRule className="w-40" />
        <p className="max-w-lg text-stone-700">{t.confirmedIntro(maskEmail(order.email))}</p>
        <p className="rounded-pill bg-emerald-100 px-4 py-1.5 font-medium text-emerald-700">
          {t.orderNumber}: <span data-testid="order-number">{order.number}</span>
        </p>
      </header>

      <section
        aria-labelledby="confirmed-items"
        className="rounded-card border border-line bg-white p-6"
      >
        <h2 id="confirmed-items" className="mb-4 font-display text-h3">
          {t.items}
        </h2>
        <ul className="divide-y divide-line">
          {order.items.map((item) => (
            <li key={item.id} className="flex gap-4 py-4">
              <div className="relative h-24 w-18 shrink-0 overflow-hidden rounded-card bg-jaali">
                {item.imageSnapshot ? (
                  <StaticImage
                    src={item.imageSnapshot}
                    alt=""
                    fill
                    sizes="72px"
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="flex flex-1 justify-between gap-4">
                <div>
                  <p className="font-medium">{item.titleSnapshot}</p>
                  <p className="text-body-sm text-stone-700">
                    {item.isCustom ? en.bag.customFit : en.bag.size(item.size ?? "")} ·{" "}
                    {en.email.qty(item.quantity)}
                  </p>
                </div>
                <Price cents={item.unitPriceCents * item.quantity} />
              </div>
            </li>
          ))}
        </ul>
        <dl className="mt-4 flex flex-col gap-2 border-t border-line pt-4 text-body-sm">
          {order.discountCents > 0 ? (
            <div className="flex justify-between">
              <dt>{en.email.discount}</dt>
              <dd className="tabular-nums">−{formatCents(order.discountCents)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt>{en.bag.shipping}</dt>
            <dd className="text-emerald-700">{en.bag.shippingFree}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{en.bag.duties}</dt>
            <dd className="text-emerald-700">{en.bag.dutiesIncluded}</dd>
          </div>
          <div className="flex justify-between text-body font-medium">
            <dt>{en.email.total}</dt>
            <dd className="tabular-nums" data-testid="order-total">
              {formatCents(order.totalCents)}
            </dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <section aria-labelledby="confirmed-next">
          <h2 id="confirmed-next" className="mb-4 font-display text-h3">
            {t.next}
          </h2>
          <Timeline
            items={[
              { label: t.steps.paid, state: "complete" },
              { label: t.steps.confirmed, state: "current" },
              { label: t.steps.production, state: "upcoming" },
              { label: t.steps.shipped, state: "upcoming" },
              { label: t.steps.delivered, state: "upcoming" },
            ]}
          />
          {hasCustom ? <p className="mt-4 text-body-sm">{t.customFitNext}</p> : null}
        </section>
        <section aria-labelledby="confirmed-address">
          <h2 id="confirmed-address" className="mb-4 font-display text-h3">
            {t.shipTo}
          </h2>
          <p className="text-stone-700">
            {order.customerName}
            <br />
            {address.line1}
            {address.line2 ? (
              <>
                <br />
                {address.line2}
              </>
            ) : null}
            <br />
            {address.city}, {address.state} {address.postalCode}
          </p>
        </section>
      </div>

      <div className="flex justify-center">
        <ButtonLink href="/shop" variant="secondary">
          {t.continueShopping}
        </ButtonLink>
      </div>
    </div>
  );
}
