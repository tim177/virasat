import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ProductListing, ProductListingSkeleton } from "@/components/shop/product-listing";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { categories, categoryBySlug } from "@/lib/catalog";
import { en } from "@/lib/i18n/en";

export function generateStaticParams() {
  return categories.map((category) => ({ category: category.slug }));
}

export async function generateMetadata({ params }: PageProps<"/c/[category]">): Promise<Metadata> {
  const { category } = await params;
  const info = categoryBySlug(category);
  if (!info) return {};
  return {
    title: info.label,
    description: en.seo.categoryDescription(info.label),
    alternates: { canonical: `/c/${info.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/c/[category]">) {
  const { category } = await params;
  const info = categoryBySlug(category);
  if (!info) notFound();

  return (
    <div className="page-container flex flex-col gap-6 py-6 md:py-10">
      <Breadcrumbs items={[{ label: en.ui.home, href: "/" }, { label: info.label }]} />
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-h1">{info.label}</h1>
        <p className="max-w-2xl text-stone-700">{en.listing.categoryIntros[info.value]}</p>
      </header>
      <Suspense fallback={<ProductListingSkeleton />}>
        <ProductListing
          basePath={`/c/${info.slug}`}
          category={info.value}
          searchParams={searchParams}
          listName={`category:${info.slug}`}
        />
      </Suspense>
    </div>
  );
}
