import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { DeleteProfileButton } from "@/components/fit/delete-profile-button";
import { OrderStatusPill } from "@/components/orders/order-status-pill";
import { ButtonLink } from "@/components/ui/button-link";
import { ZariRule } from "@/components/ui/ornament";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCustomer } from "@/lib/customer-auth";
import { listCustomerOrders } from "@/lib/customer-orders";
import { listFitProfiles } from "@/lib/fit-profiles";
import { en } from "@/lib/i18n/en";
import { formatCents } from "@/lib/money";

const t = en.account;
const tp = en.fit.profiles;
const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "America/New_York",
});

export const metadata: Metadata = {
  title: t.metaTitle,
  robots: { index: false, follow: false },
};

// Account pages read the session on every request, so navigations wait for the server.
export const instant = false;

export default function AccountPage() {
  return (
    <div className="page-container flex flex-1 flex-col py-8 md:py-12">
      <Suspense fallback={<AccountSkeleton />}>
        <AccountOverview />
      </Suspense>
    </div>
  );
}

async function AccountOverview() {
  await connection();
  const customer = await requireCustomer("/account");
  const [orders, profiles] = await Promise.all([
    listCustomerOrders(customer),
    listFitProfiles(customer.id),
  ]);
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-h1">{t.title}</h1>
        <ZariRule className="w-32" />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-stone-700">{t.signedInAs(customer.email)}</p>
          <SignOutButton label={t.signOut} redirectTo="/" variant="secondary" />
        </div>
      </header>

      <section aria-labelledby="your-orders" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="your-orders" className="font-display text-h2">
            {t.ordersTitle}
          </h2>
          <p className="text-body-sm text-stone-700">{t.ordersIntro(customer.email)}</p>
        </div>
        {orders.length === 0 ? (
          <div className="flex flex-col items-start gap-4 rounded-card border border-line bg-white p-6">
            <p className="text-stone-700">{t.noOrders}</p>
            <ButtonLink href="/shop" variant="secondary">
              {t.startShopping}
            </ButtonLink>
          </div>
        ) : (
          <ul
            className="divide-y divide-line rounded-card border border-line bg-white"
            data-testid="account-orders"
          >
            {orders.map((order) => (
              <li
                key={order.number}
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4"
              >
                <div className="flex flex-col gap-1">
                  <Link
                    href={`/account/orders/${order.number}`}
                    className="inline-flex min-h-11 items-center font-medium text-crimson-700 underline"
                  >
                    {order.number}
                  </Link>
                  <p className="text-body-sm text-stone-700">
                    {dateFormat.format(order.paidAt)} · {t.pieces(order.pieces)}
                    {order.hasCustom ? ` · ${en.bag.customFit}` : null}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <OrderStatusPill status={order.status} />
                  <span className="tabular-nums">{formatCents(order.totalCents)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="fit-profiles" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="fit-profiles" className="font-display text-h2">
              {tp.title}
            </h2>
            <p className="text-body-sm text-stone-700">{tp.intro}</p>
          </div>
          <ButtonLink href="/account/fit-profiles/new" variant="secondary">
            {tp.add}
          </ButtonLink>
        </div>
        {profiles.length === 0 ? (
          <p className="rounded-card border border-line bg-white p-6 text-stone-700">{tp.empty}</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profiles.map((profile) => (
              <li
                key={profile.id}
                className="flex flex-col gap-1 rounded-card border border-line bg-white p-5"
              >
                <h3 className="font-display text-h3">{profile.name}</h3>
                <p className="text-body-sm text-stone-700">
                  {en.fit.kinds[profile.kind]}
                  {profile.set ? ` · ${en.fit.unitNames[profile.set.unit]}` : null}
                </p>
                <p className="text-body-sm text-stone-700">
                  {tp.updated(dateFormat.format(profile.updatedAt))}
                </p>
                <div className="mt-2 flex gap-4">
                  <Link
                    href={`/account/fit-profiles/${profile.id}`}
                    className="inline-flex min-h-11 items-center text-crimson-700 underline"
                  >
                    {tp.editShort}
                    <span className="sr-only"> {profile.name}</span>
                  </Link>
                  <DeleteProfileButton id={profile.id} name={profile.name} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AccountSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <p className="sr-only">{en.ui.loading}</p>
      <Skeleton className="h-12 w-1/2" />
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-40" />
    </div>
  );
}
