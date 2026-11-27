import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ProductForm } from "@/components/admin/product-form";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/admin-auth";
import { productFormInitial } from "@/lib/admin-products";
import { en } from "@/lib/i18n/en";

const t = en.admin.product;

export const metadata: Metadata = { title: t.newTitle };

export default function NewProductPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Link
        href="/admin/products"
        className="inline-flex min-h-11 items-center gap-1 self-start text-body-sm hover:underline"
      >
        <ChevronLeftIcon className="size-4" />
        {t.back}
      </Link>
      <h1 className="font-display text-h2">{t.newTitle}</h1>
      <Suspense fallback={<Skeleton className="h-[40rem] w-full" />}>
        <NewProductForm />
      </Suspense>
    </div>
  );
}

async function NewProductForm() {
  await requireAdmin();
  return <ProductForm initial={productFormInitial(null)} />;
}
