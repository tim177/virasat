import { TrackEvent } from "@/components/analytics/track-event";
import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProductCategory } from "@/lib/generated/prisma/enums";
import { en } from "@/lib/i18n/en";
import {
  activeFilterCount,
  listingHref,
  MAX_PAGES,
  PAGE_SIZE,
  parseListingParams,
} from "@/lib/listing-params";
import { getFacets, getListing } from "@/lib/products";

import { FilterDrawer } from "./filter-drawer";
import { FilterForm } from "./filter-form";
import { ActiveFilters, SortLinks } from "./listing-controls";
import { ProductGrid } from "./product-grid";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Filterable product listing shared by category pages (/c/...) and /shop.
 * Reads the URL's search params, so it must sit inside <Suspense> (Cache Components).
 */
export async function ProductListing({
  basePath,
  category,
  searchParams,
  listName,
}: {
  basePath: string;
  /** Fixed category (category pages). Leave out on /shop to allow a category filter. */
  category?: ProductCategory;
  searchParams: SearchParams;
  listName: string;
}) {
  const allowCategory = category === undefined;
  const query = parseListingParams(await searchParams, { allowCategory });
  const filters = {
    category: category ?? query.category,
    occasions: query.occasions,
    colours: query.colours,
    fabrics: query.fabrics,
    sort: query.sort,
  };

  const [facets, { total, products }] = await Promise.all([
    getFacets(category),
    getListing(filters, query.page * PAGE_SIZE),
  ]);
  const shown = products.length;
  const form = (
    <FilterForm action={basePath} query={query} facets={facets} allowCategory={allowCategory} />
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[15rem_1fr] lg:gap-10">
      <aside aria-label={en.listing.filters} className="hidden lg:block">
        {form}
      </aside>

      <section aria-labelledby="listing-results" className="flex min-w-0 flex-col gap-5">
        <h2 id="listing-results" className="sr-only">
          {en.listing.results}
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterDrawer activeCount={activeFilterCount(query)}>{form}</FilterDrawer>
          <p className="text-body-sm text-stone-700" data-testid="result-count">
            {en.listing.resultCount(shown, total)}
          </p>
          <SortLinks basePath={basePath} query={query} />
        </div>

        <ActiveFilters basePath={basePath} query={query} />

        {shown === 0 ? (
          <EmptyState
            headingLevel={3}
            title={en.listing.emptyTitle}
            description={en.listing.emptyText}
            action={
              <ButtonLink href={basePath} variant="secondary">
                {en.listing.clearAll}
              </ButtonLink>
            }
          />
        ) : (
          <ProductGrid products={products} priorityFirst />
        )}

        {shown < total && query.page < MAX_PAGES ? (
          <div className="flex justify-center pt-4">
            <ButtonLink
              href={listingHref(basePath, { ...query, page: query.page + 1 })}
              scroll={false}
              variant="secondary"
            >
              {en.listing.loadMore}
            </ButtonLink>
          </div>
        ) : null}

        <TrackEvent event="view_item_list" properties={{ list: listName, count: shown, total }} />
      </section>
    </div>
  );
}

export function ProductListingSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-8 lg:grid-cols-[15rem_1fr] lg:gap-10">
      <p className="sr-only">{en.ui.loading}</p>
      <Skeleton className="hidden h-96 lg:block" />
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="aspect-3/4" />
        ))}
      </div>
    </div>
  );
}
