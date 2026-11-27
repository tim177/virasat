import type { Metadata } from "next";
import Link from "next/link";
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

const shortcuts = [
  { href: "/admin/orders", title: en.admin.ordersNav, text: en.admin.homeOrders },
  { href: "/admin/products", title: en.admin.productsNav, text: en.admin.homeProducts },
];

async function AdminHome() {
  const admin = await requireAdmin();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-h2">{en.admin.welcome(admin.name)}</h1>
        <p className="text-stone-700">{en.admin.comingSoon}</p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {shortcuts.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex h-full flex-col gap-1 rounded-card border border-line bg-white p-5 hover:border-charcoal"
            >
              <span className="font-display text-h3">{item.title}</span>
              <span className="text-body-sm text-stone-700">{item.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
