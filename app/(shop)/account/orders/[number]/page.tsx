import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";

import { OrderDetails } from "@/components/orders/order-details";
import { OrderSkeleton } from "@/components/orders/order-skeleton";
import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/ui/empty-state";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { requireCustomer } from "@/lib/customer-auth";
import { getCustomerOrder } from "@/lib/customer-orders";
import { en } from "@/lib/i18n/en";

const t = en.orders;

export const metadata: Metadata = {
  title: t.status,
  robots: { index: false, follow: false },
};
export const instant = false;

const numberSchema = z.string().regex(/^VRS-\d{1,9}$/);

export default function AccountOrderPage({ params }: PageProps<"/account/orders/[number]">) {
  return (
    <div className="page-container flex flex-1 flex-col gap-6 py-8 md:py-12">
      <Link
        href="/account"
        className="inline-flex min-h-11 items-center gap-1 self-start text-body-sm hover:underline"
      >
        <ChevronLeftIcon className="size-4" />
        {t.backToAccount}
      </Link>
      <Suspense fallback={<OrderSkeleton />}>
        <AccountOrder params={params} />
      </Suspense>
    </div>
  );
}

async function AccountOrder({
  params,
}: {
  params: PageProps<"/account/orders/[number]">["params"];
}) {
  await connection();
  const raw = decodeURIComponent((await params).number);
  const customer = await requireCustomer(`/account/orders/${encodeURIComponent(raw)}`);
  const number = numberSchema.safeParse(raw);
  // Someone else's order looks exactly like one that doesn't exist.
  const order = number.success ? await getCustomerOrder(customer, number.data) : null;
  if (!order) {
    return (
      <EmptyState
        headingLevel={1}
        title={t.notFoundTitle}
        action={<ButtonLink href="/account">{t.backToAccount}</ButtonLink>}
      />
    );
  }
  return <OrderDetails order={order} />;
}
