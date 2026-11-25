import Link from "next/link";

import { CloseIcon } from "@/components/ui/icons";
import { categoryByValue, occasionLabels } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { en } from "@/lib/i18n/en";
import {
  activeFilterCount,
  listingHref,
  sortOptions,
  withoutValue,
  type ListingQuery,
} from "@/lib/listing-params";

/** Sort choices as links: shareable URLs, no JavaScript needed. Changing sort resets paging. */
export function SortLinks({ basePath, query }: { basePath: string; query: ListingQuery }) {
  return (
    <nav aria-label={en.listing.sortLabel}>
      <ul className="flex flex-wrap items-center gap-x-1">
        <li aria-hidden="true" className="pr-1 text-body-sm text-stone-700">
          {en.listing.sortLabel}:
        </li>
        {sortOptions.map((sort) => {
          const current = sort === query.sort;
          return (
            <li key={sort}>
              <Link
                href={listingHref(basePath, { ...query, sort, page: 1 })}
                aria-current={current ? "true" : undefined}
                scroll={false}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-pill px-3 text-body-sm transition-colors duration-150",
                  current ? "bg-charcoal text-white" : "hover:bg-sand",
                )}
              >
                {en.listing.sortOptions[sort]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Chips for each active filter; each one is a link that removes it. */
export function ActiveFilters({ basePath, query }: { basePath: string; query: ListingQuery }) {
  if (activeFilterCount(query) === 0) return null;

  const chips: Array<{ label: string; href: string }> = [
    ...(query.category
      ? [
          {
            label: categoryByValue(query.category).label,
            href: listingHref(basePath, withoutValue(query, "category")),
          },
        ]
      : []),
    ...query.occasions.map((o) => ({
      label: occasionLabels[o],
      href: listingHref(basePath, withoutValue(query, "occasions", o)),
    })),
    ...query.colours.map((c) => ({
      label: c,
      href: listingHref(basePath, withoutValue(query, "colours", c)),
    })),
    ...query.fabrics.map((f) => ({
      label: f,
      href: listingHref(basePath, withoutValue(query, "fabrics", f)),
    })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="sr-only">{en.listing.activeFilters}</h2>
      <ul className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <li key={chip.href}>
            <Link
              href={chip.href}
              scroll={false}
              aria-label={en.listing.removeFilter(chip.label)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-stone-700 bg-white pr-3 pl-4 text-body-sm hover:bg-sand"
            >
              {chip.label}
              <CloseIcon className="size-4" />
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href={basePath}
        scroll={false}
        className="inline-flex min-h-11 items-center px-2 text-body-sm underline underline-offset-4"
      >
        {en.listing.clearAll}
      </Link>
    </div>
  );
}
