import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";

import { TrackEvent } from "@/components/analytics/track-event";
import { ProductGrid } from "@/components/shop/product-grid";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchIcon } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { categories } from "@/lib/catalog";
import { querySearch } from "@/lib/catalog-queries";
import { en } from "@/lib/i18n/en";
import { toProductCard } from "@/lib/product-cards";
import {
  isEmptySearch,
  MAX_QUERY_LENGTH,
  normalizeQuery,
  parseSearchQuery,
} from "@/lib/search-terms";

export const metadata: Metadata = {
  title: en.search.title,
  // Result pages are endless variations of the same products; keep them out of search engines.
  robots: { index: false, follow: true },
};

const RESULT_LIMIT = 48;

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div className="page-container flex flex-col gap-8 py-6 md:py-10">
      <h1 className="font-display text-h1">{en.search.title}</h1>
      <Suspense fallback={<SearchSkeleton />}>
        <SearchResults searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SearchResults({
  searchParams,
}: {
  searchParams: PageProps<"/search">["searchParams"];
}) {
  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : (raw ?? "")).slice(0, MAX_QUERY_LENGTH).trim();
  const terms = parseSearchQuery(query);
  const hasQuery = !isEmptySearch(terms);
  const { total, products } = hasQuery
    ? await querySearch(terms, RESULT_LIMIT)
    : { total: 0, products: [] };

  return (
    <div className="flex flex-col gap-8">
      <SearchForm defaultValue={query} />

      {!hasQuery ? (
        <div className="flex flex-col gap-4">
          <p className="text-stone-700">{en.search.prompt}</p>
          <CategoryLinks />
        </div>
      ) : total === 0 ? (
        <>
          <EmptyState
            title={en.search.noResultsTitle(query)}
            description={en.search.noResultsText}
            action={<CategoryLinks />}
          />
          <TrackEvent event="search_no_results" properties={{ query: normalizeQuery(query) }} />
        </>
      ) : (
        <section aria-labelledby="search-results" className="flex flex-col gap-5">
          <h2 id="search-results" className="text-body text-stone-700" data-testid="result-count">
            {en.search.resultCount(total, query)}
          </h2>
          <ProductGrid products={products.map(toProductCard)} priorityFirst />
          <TrackEvent
            event="search"
            properties={{ query: normalizeQuery(query), results: total }}
          />
        </section>
      )}
    </div>
  );
}

function SearchForm({ defaultValue }: { defaultValue: string }) {
  return (
    <Form action="/search" role="search" className="flex max-w-2xl gap-2">
      <label htmlFor="search-q" className="sr-only">
        {en.search.label}
      </label>
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-stone-700" />
        <input
          id="search-q"
          name="q"
          type="search"
          defaultValue={defaultValue}
          maxLength={MAX_QUERY_LENGTH}
          placeholder={en.search.placeholder}
          autoComplete="off"
          enterKeyHint="search"
          className="min-h-11 w-full rounded-field border border-stone-700 bg-white pr-3 pl-10 text-body placeholder:text-stone-700"
        />
      </div>
      <Button type="submit">{en.search.submit}</Button>
    </Form>
  );
}

function CategoryLinks() {
  return (
    <nav aria-label={en.search.browse}>
      <ul className="flex flex-wrap justify-center gap-2">
        {categories.map((category) => (
          <li key={category.slug}>
            <Link
              href={`/c/${category.slug}`}
              className="inline-flex min-h-11 items-center rounded-pill border border-charcoal bg-white px-5 hover:bg-sand"
            >
              {category.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SearchSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-8">
      <p className="sr-only">{en.ui.loading}</p>
      <Skeleton className="h-11 max-w-2xl" />
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="aspect-3/4" />
        ))}
      </div>
    </div>
  );
}
