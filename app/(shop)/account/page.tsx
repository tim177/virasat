import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { ZariRule } from "@/components/ui/ornament";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCustomer } from "@/lib/customer-auth";
import { en } from "@/lib/i18n/en";

const t = en.account;

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
