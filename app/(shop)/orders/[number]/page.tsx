import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";

import { OrderDetails } from "@/components/orders/order-details";
import { OrderSkeleton } from "@/components/orders/order-skeleton";
import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/ui/empty-state";
import { getOrderByToken } from "@/lib/customer-orders";
import { en } from "@/lib/i18n/en";

const t = en.orders;

// The link in every order email: /orders/VRS-1001?t=<secret>. Works without signing in.
// The secret is in the address, so the page is never indexed and never sends it to other sites
// (tracking and Cal.com links) as a referrer.
export const metadata: Metadata = {
  title: t.status,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// Every visit is checked against the database, so navigations wait for the server.
export const instant = false;

const numberSchema = z.string().regex(/^VRS-\d{1,9}$/);
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{20,64}$/);

export default function OrderStatusPage({ params, searchParams }: PageProps<"/orders/[number]">) {
  return (
    <div className="page-container flex flex-1 flex-col py-8 md:py-12">
      <Suspense fallback={<OrderSkeleton />}>
        <OrderFromLink params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function OrderFromLink({
  params,
  searchParams,
}: Pick<PageProps<"/orders/[number]">, "params" | "searchParams">) {
  await connection();
  const number = numberSchema.safeParse(decodeURIComponent((await params).number));
  const rawToken = (await searchParams).t;
  const token = tokenSchema.safeParse(Array.isArray(rawToken) ? rawToken[0] : rawToken);
  const order =
    number.success && token.success ? await getOrderByToken(number.data, token.data) : null;
  if (!order) {
    return (
      <EmptyState
        headingLevel={1}
        title={t.notFoundTitle}
        description={t.notFoundText}
        action={<ButtonLink href="/login?next=%2Faccount">{t.signIn}</ButtonLink>}
      />
    );
  }
  return <OrderDetails order={order} />;
}
