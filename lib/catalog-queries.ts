import "server-only";

import { getDb } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { Occasion, ProductCategory } from "@/lib/generated/prisma/enums";
import type { SortOption } from "@/lib/listing-params";
import type { SearchTerms } from "@/lib/search-terms";

// Plain database reads for the shop. No Next.js APIs here, so integration tests can call them
// directly. Pages use the cached wrappers in lib/products.ts instead.
// Every query only ever returns published products.

export const cardSelect = {
  slug: true,
  title: true,
  fabric: true,
  work: true,
  priceCents: true,
  compareAtCents: true,
  customFitAvailable: true,
  images: { orderBy: { position: "asc" }, take: 1, select: { url: true, alt: true } },
} satisfies Prisma.ProductSelect;

export type ProductCardRow = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

export type ListingFilters = {
  category?: ProductCategory;
  occasions: Occasion[];
  colours: string[];
  fabrics: string[];
  sort: SortOption;
};

const orderBy: Record<SortOption, Prisma.ProductOrderByWithRelationInput[]> = {
  newest: [{ createdAt: "desc" }, { id: "desc" }],
  "price-asc": [{ priceCents: "asc" }, { id: "asc" }],
  "price-desc": [{ priceCents: "desc" }, { id: "desc" }],
};

function listingWhere(filters: ListingFilters): Prisma.ProductWhereInput {
  return {
    status: "published",
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.occasions.length ? { occasions: { hasSome: filters.occasions } } : {}),
    ...(filters.colours.length ? { colour: { in: filters.colours } } : {}),
    ...(filters.fabrics.length ? { fabric: { in: filters.fabrics } } : {}),
  };
}

export async function queryListing(filters: ListingFilters, limit: number) {
  const db = getDb();
  const where = listingWhere(filters);
  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({ where, orderBy: orderBy[filters.sort], take: limit, select: cardSelect }),
  ]);
  return { total, products };
}

/** Filter choices that actually exist among published products (optionally in one category). */
export async function queryFacets(category?: ProductCategory) {
  const rows = await getDb().product.findMany({
    where: { status: "published", ...(category ? { category } : {}) },
    select: { colour: true, fabric: true, occasions: true },
  });
  const sorted = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));
  return {
    colours: sorted(rows.map((r) => r.colour)),
    fabrics: sorted(rows.map((r) => r.fabric)),
    occasions: [...new Set(rows.flatMap((r) => r.occasions))],
  };
}

export async function queryProductBySlug(slug: string) {
  return getDb().product.findFirst({
    where: { slug, status: "published" },
    select: {
      slug: true,
      title: true,
      description: true,
      category: true,
      gender: true,
      fabric: true,
      work: true,
      colour: true,
      occasions: true,
      care: true,
      priceCents: true,
      compareAtCents: true,
      customFitAvailable: true,
      customFitExtraCents: true,
      readyDays: true,
      customDays: true,
      updatedAt: true,
      images: { orderBy: { position: "asc" }, select: { url: true, alt: true } },
      variants: {
        orderBy: { position: "asc" },
        select: { id: true, size: true, sku: true, stock: true },
      },
    },
  });
}

export type ProductDetailRow = NonNullable<Awaited<ReturnType<typeof queryProductBySlug>>>;

export async function queryRelated(category: ProductCategory, excludeSlug: string, limit: number) {
  return getDb().product.findMany({
    where: { status: "published", category, slug: { not: excludeSlug } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: cardSelect,
  });
}

export async function queryPublishedSlugs() {
  return getDb().product.findMany({
    where: { status: "published" },
    orderBy: { createdAt: "asc" },
    select: { slug: true, updatedAt: true },
  });
}

/** The newest photo in each category, for the home page's category arches. */
export async function queryCategoryCovers(categories: ProductCategory[]) {
  const db = getDb();
  const covers = await Promise.all(
    categories.map((category) =>
      db.product.findFirst({
        where: { status: "published", category, images: { some: {} } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { images: { orderBy: { position: "asc" }, take: 1, select: { url: true } } },
      }),
    ),
  );
  return categories.map((category, i) => ({
    category,
    imageUrl: covers[i]?.images[0]?.url ?? null,
  }));
}

/** Every term must match: categories, occasions, and each word in title/colour/fabric/work. */
export async function querySearch(terms: SearchTerms, limit: number) {
  const db = getDb();
  const where: Prisma.ProductWhereInput = {
    status: "published",
    AND: [
      ...(terms.categories.length ? [{ category: { in: terms.categories } }] : []),
      ...(terms.occasions.length ? [{ occasions: { hasSome: terms.occasions } }] : []),
      ...terms.words.map((word) => ({
        OR: (["title", "colour", "fabric", "work"] as const).map((field) => ({
          [field]: { contains: word, mode: "insensitive" as const },
        })),
      })),
    ],
  };
  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      select: cardSelect,
    }),
  ]);
  return { total, products };
}
