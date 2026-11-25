import type { Metadata } from "next";
import { Suspense } from "react";

import { ProductListing, ProductListingSkeleton } from "@/components/shop/product-listing";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { en } from "@/lib/i18n/en";

export const metadata: Metadata = {
  title: en.seo.allTitle,
  alternates: { canonical: "/shop" },
};

/** Every published piece, with a category filter. Occasion links on the home page land here. */
export default function ShopPage({ searchParams }: PageProps<"/shop">) {
  return (
    <div className="page-container flex flex-col gap-6 py-6 md:py-10">
      <Breadcrumbs items={[{ label: en.ui.home, href: "/" }, { label: en.listing.allTitle }]} />
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-h1">{en.listing.allTitle}</h1>
        <p className="max-w-2xl text-stone-700">{en.listing.allIntro}</p>
      </header>
      <Suspense fallback={<ProductListingSkeleton />}>
        <ProductListing basePath="/shop" searchParams={searchParams} listName="all" />
      </Suspense>
    </div>
  );
}
