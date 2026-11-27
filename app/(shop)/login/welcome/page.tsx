import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { SignedIn } from "@/components/auth/signed-in";
import { getCustomer, isNewAccount } from "@/lib/customer-auth";
import { en } from "@/lib/i18n/en";
import { safeNextPath } from "@/lib/safe-next";

export const metadata: Metadata = {
  title: en.login.metaTitle,
  robots: { index: false, follow: false },
};

// A short stop after every customer sign-in (email code or Google): records the login or
// sign_up analytics event, then opens the page the shopper came from.
export default function WelcomePage({ searchParams }: PageProps<"/login/welcome">) {
  return (
    <div className="page-container flex flex-1 items-center justify-center py-16">
      <Suspense fallback={<p className="text-stone-700">{en.login.signingIn}</p>}>
        <Welcome searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Welcome({
  searchParams,
}: {
  searchParams: PageProps<"/login/welcome">["searchParams"];
}) {
  await connection();
  const params = await searchParams;
  const next = safeNextPath(Array.isArray(params.next) ? params.next[0] : params.next);
  const customer = await getCustomer();
  if (!customer) redirect(`/login?next=${encodeURIComponent(next)}`);
  const method = params.via === "google" ? "google" : "email";
  return (
    <SignedIn event={isNewAccount(customer) ? "sign_up" : "login"} method={method} next={next} />
  );
}
