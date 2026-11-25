import { z } from "zod";

import { categoryBySlug, categoryByValue } from "@/lib/catalog";
import { Occasion, type ProductCategory } from "@/lib/generated/prisma/enums";

// Category and shop filters live in the URL (shareable, crawlable, work without JavaScript):
//   /c/lehengas?occasion=wedding&colour=Red&fabric=Silk&sort=price-asc&page=2
// This module validates those parameters and builds links that change one of them.

export const PAGE_SIZE = 24;
export const MAX_PAGES = 20;

export const sortOptions = ["newest", "price-asc", "price-desc"] as const;
export type SortOption = (typeof sortOptions)[number];

export type ListingQuery = {
  occasions: Occasion[];
  colours: string[];
  fabrics: string[];
  sort: SortOption;
  page: number;
  /** Only on /shop (all products); category pages fix the category from the path. */
  category?: ProductCategory;
};

type RawParams = Record<string, string | string[] | undefined>;

const occasionValues = Object.values(Occasion) as Occasion[];

/** One or many values → a clean, de-duplicated list of short strings. */
const stringList = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    const list = value === undefined ? [] : Array.isArray(value) ? value : [value];
    const cleaned = list.map((v) => v.trim()).filter((v) => v.length > 0 && v.length <= 40);
    return [...new Set(cleaned)].slice(0, 10);
  });

const firstString = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => (Array.isArray(value) ? value[0] : value));

const paramsSchema = z.object({
  occasion: stringList.transform((list) =>
    list.filter((v): v is Occasion => occasionValues.includes(v as Occasion)),
  ),
  colour: stringList,
  fabric: stringList,
  sort: firstString.transform((v): SortOption =>
    sortOptions.includes(v as SortOption) ? (v as SortOption) : "newest",
  ),
  page: firstString.transform((v) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 && n <= MAX_PAGES ? n : 1;
  }),
  category: firstString.transform((v) => (v ? categoryBySlug(v)?.value : undefined)),
});

/** Never throws: unknown or malformed values are dropped, so bad links still show products. */
export function parseListingParams(raw: RawParams, { allowCategory = false } = {}): ListingQuery {
  const parsed = paramsSchema.parse(raw);
  return {
    occasions: parsed.occasion,
    colours: parsed.colour,
    fabrics: parsed.fabric,
    sort: parsed.sort,
    page: parsed.page,
    ...(allowCategory && parsed.category ? { category: parsed.category } : {}),
  };
}

export function activeFilterCount(query: ListingQuery): number {
  return (
    query.occasions.length + query.colours.length + query.fabrics.length + (query.category ? 1 : 0)
  );
}

/** Builds a listing URL from a query. Default values are left out to keep URLs short. */
export function listingHref(basePath: string, query: ListingQuery): string {
  const params = new URLSearchParams();
  if (query.category) params.set("category", categoryByValue(query.category).slug);
  for (const v of query.occasions) params.append("occasion", v);
  for (const v of query.colours) params.append("colour", v);
  for (const v of query.fabrics) params.append("fabric", v);
  if (query.sort !== "newest") params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  const search = params.toString();
  return search ? `${basePath}?${search}` : basePath;
}

/** The same query with one filter value removed (for "remove filter" chips). Resets paging. */
export function withoutValue(
  query: ListingQuery,
  key: "occasions" | "colours" | "fabrics" | "category",
  value?: string,
): ListingQuery {
  if (key === "category") return { ...query, category: undefined, page: 1 };
  return { ...query, [key]: (query[key] as string[]).filter((v) => v !== value), page: 1 };
}
