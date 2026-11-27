import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { ProductForm } from "@/components/admin/product-form";
import { StatusPill } from "@/components/ui/badge";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminProduct, productFormInitial } from "@/lib/admin-products";
import { en } from "@/lib/i18n/en";

const t = en.admin.product;

export const metadata: Metadata = { title: en.admin.products.metaTitle };

export default function EditProductPage({
  params,
  searchParams,
}: PageProps<"/admin/products/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Link
        href="/admin/products"
        className="inline-flex min-h-11 items-center gap-1 self-start text-body-sm hover:underline"
      >
        <ChevronLeftIcon className="size-4" />
        {t.back}
      </Link>
      <Suspense fallback={<Skeleton className="h-[40rem] w-full" />}>
        <EditProduct params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function EditProduct({
  params,
  searchParams,
}: {
  params: PageProps<"/admin/products/[id]">["params"];
  searchParams: PageProps<"/admin/products/[id]">["searchParams"];
}) {
  await requireAdmin();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const product = await getAdminProduct(id.data);
  if (!product) notFound();
  const created = (await searchParams).created === "1";

  return (
    <>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="font-display text-h2">{t.editTitle(product.title)}</h1>
        <StatusPill
          tone={product.status === "published" ? "success" : "neutral"}
          label={en.productStatus[product.status]}
        />
        {product.status === "published" ? (
          <a
            href={`/p/${product.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center text-crimson-700 underline underline-offset-4"
          >
            {t.viewInShop}
          </a>
        ) : null}
      </header>
      {/* key: a fresh form after each save, so it shows what was saved. */}
      <ProductForm
        key={product.updatedAt.toISOString()}
        initial={productFormInitial(product)}
        notice={created ? t.created : undefined}
      />
    </>
  );
}
