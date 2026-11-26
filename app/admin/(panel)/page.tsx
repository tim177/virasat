import type { Metadata } from "next";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/admin-auth";
import { en } from "@/lib/i18n/en";

export const metadata: Metadata = { title: en.admin.dashboard };

export default function AdminHomePage() {
  return (
    <Suspense fallback={<Skeleton className="h-10 w-64" />}>
      <AdminHome />
    </Suspense>
  );
}

async function AdminHome() {
  const admin = await requireAdmin();
  return (
    <div className="flex flex-col gap-3">
      <h1 className="font-display text-h2">{en.admin.welcome(admin.name)}</h1>
      <p className="text-stone-700">{en.admin.comingSoon}</p>
    </div>
  );
}
