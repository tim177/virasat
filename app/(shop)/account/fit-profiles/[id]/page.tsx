import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";

import { FitProfileEditor } from "@/components/fit/fit-profile-editor";
import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/ui/empty-state";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCustomer } from "@/lib/customer-auth";
import { getFitProfile } from "@/lib/fit-profiles";
import { en } from "@/lib/i18n/en";

const t = en.fit.profiles;

export const metadata: Metadata = {
  title: en.fit.profiles.title,
  robots: { index: false, follow: false },
};
export const instant = false;

export default function EditFitProfilePage({ params }: PageProps<"/account/fit-profiles/[id]">) {
  return (
    <div className="page-container flex flex-1 flex-col gap-6 py-8 md:py-12">
      <Link
        href="/account"
        className="inline-flex min-h-11 items-center gap-1 self-start text-body-sm hover:underline"
      >
        <ChevronLeftIcon className="size-4" />
        {t.back}
      </Link>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <EditProfile params={params} />
      </Suspense>
    </div>
  );
}

async function EditProfile({
  params,
}: {
  params: PageProps<"/account/fit-profiles/[id]">["params"];
}) {
  await connection();
  const { id } = await params;
  const customer = await requireCustomer(`/account/fit-profiles/${encodeURIComponent(id)}`);
  const parsedId = z.uuid().safeParse(id);
  const profile = parsedId.success ? await getFitProfile(customer.id, parsedId.data) : null;
  if (!profile) {
    return (
      <EmptyState title={t.notFound} action={<ButtonLink href="/account">{t.back}</ButtonLink>} />
    );
  }
  return (
    <>
      <h1 className="font-display text-h1">{t.editTitle(profile.name)}</h1>
      <FitProfileEditor
        profile={{ id: profile.id, name: profile.name, kind: profile.kind, set: profile.set }}
      />
    </>
  );
}
