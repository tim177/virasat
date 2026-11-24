import { connection } from "next/server";
import { Suspense } from "react";

import { ZariRule } from "@/components/ui/ornament";
import { ProductCard } from "@/components/ui/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { checkDatabase } from "@/lib/db-health";
import { en } from "@/lib/i18n/en";
import { getNewestProducts } from "@/lib/products";

// Temporary home page (Steps 1–3). Replaced by the real home page in Step 4.
export default function Home() {
  return (
    <div className="page-container flex flex-1 flex-col gap-12 py-16">
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-h1 md:text-display-2">Virasat</h1>
        <ZariRule className="max-w-xs" />
        <p className="max-w-xl text-body-lg text-stone-700">
          Project setup is running. The shop arrives in the next steps.
        </p>
        <Suspense fallback={<p role="status">Checking database…</p>}>
          <DatabaseStatus />
        </Suspense>
      </div>

      <section aria-labelledby="new-arrivals" className="flex flex-col gap-6">
        <h2 id="new-arrivals" className="font-display text-h2">
          {en.catalog.newArrivals}
        </h2>
        <Suspense fallback={<ProductGridSkeleton />}>
          <NewArrivals />
        </Suspense>
      </section>
    </div>
  );
}

async function DatabaseStatus() {
  await connection();
  const db = await checkDatabase();

  return (
    <p role="status" data-testid="db-status">
      {db.ok ? `Database: connected (${db.latencyMs} ms)` : "Database: not connected"}
    </p>
  );
}

async function NewArrivals() {
  await connection();
  const products = await getNewestProducts(4);

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
      {products.map((product, index) => (
        <li key={product.href}>
          <ProductCard product={product} preloadImage={index === 0} />
        </li>
      ))}
    </ul>
  );
}

function ProductGridSkeleton() {
  return (
    <div aria-busy="true" className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
      <p className="sr-only">{en.ui.loading}</p>
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="aspect-[3/4]" />
      ))}
    </div>
  );
}
