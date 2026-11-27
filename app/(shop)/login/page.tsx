import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";
import { ZariRule } from "@/components/ui/ornament";
import { Skeleton } from "@/components/ui/skeleton";
import { getCustomer } from "@/lib/customer-auth";
import { en } from "@/lib/i18n/en";
import { loginOptions } from "@/lib/login-config";
import { safeNextPath } from "@/lib/safe-next";

const t = en.login;

export const metadata: Metadata = {
  title: t.metaTitle,
  robots: { index: false, follow: false },
};

/** Customer sign-in: an email code or Google. Accounts are optional; guests can still buy. */
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="page-container flex flex-1 items-center justify-center py-10 md:py-16">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-card border border-line bg-white p-6 shadow-raised sm:p-8">
        <header className="flex flex-col items-center gap-3 text-center">
          <h1 className="font-display text-h2">{t.title}</h1>
          <ZariRule className="w-24" />
          <p className="text-body-sm text-stone-700">{t.intro}</p>
        </header>
        <Suspense fallback={<LoginSkeleton />}>
          <LoginPanel searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function LoginPanel({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  await connection();
  const params = await searchParams;
  const next = safeNextPath(first(params.next));
  if (await getCustomer()) redirect(next);
  return (
    <LoginForm
      next={next}
      options={loginOptions()}
      googleFailed={first(params.error) !== undefined}
    />
  );
}

function LoginSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-5">
      <p className="sr-only">{en.ui.loading}</p>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-11" />
      <Skeleton className="h-11" />
    </div>
  );
}
