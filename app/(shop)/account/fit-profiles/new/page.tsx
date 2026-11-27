import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { FitProfileEditor } from "@/components/fit/fit-profile-editor";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCustomer } from "@/lib/customer-auth";
import { en } from "@/lib/i18n/en";

const t = en.fit.profiles;

export const metadata: Metadata = { title: t.newTitle, robots: { index: false, follow: false } };
export const instant = false;

export default function NewFitProfilePage() {
  return (
    <div className="page-container flex flex-1 flex-col gap-6 py-8 md:py-12">
      <Link
        href="/account"
        className="inline-flex min-h-11 items-center gap-1 self-start text-body-sm hover:underline"
      >
        <ChevronLeftIcon className="size-4" />
        {t.back}
      </Link>
      <h1 className="font-display text-h1">{t.newTitle}</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <NewProfile />
      </Suspense>
    </div>
  );
}

async function NewProfile() {
  await connection();
  await requireCustomer("/account/fit-profiles/new");
  return <FitProfileEditor profile={null} />;
}
