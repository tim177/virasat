import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { categories } from "@/lib/catalog";
import {
  queryCategoryCovers,
  queryFacets,
  queryListing,
  queryProductBySlug,
  queryPublishedSlugs,
  queryRelated,
  type ListingFilters,
} from "@/lib/catalog-queries";
import type { ProductCategory } from "@/lib/generated/prisma/enums";
import { toProductCard } from "@/lib/product-cards";

// Cached catalogue reads for pages. Every entry is tagged "products", so one call to
// revalidateTag(PRODUCTS_TAG) (admin save in Step 6, stock change in Step 5) refreshes the
// shop. Entries also expire after a few hours as a safety net.

export const PRODUCTS_TAG = "products";
export const productTag = (slug: string) => `product:${slug}`;

export async function getListing(filters: ListingFilters, limit: number) {
  "use cache";
  cacheTag(PRODUCTS_TAG);
  cacheLife("hours");
  const { total, products } = await queryListing(filters, limit);
  return { total, products: products.map(toProductCard) };
}

export async function getNewestProducts(limit: number) {
  "use cache";
  cacheTag(PRODUCTS_TAG);
  cacheLife("hours");
  const { products } = await queryListing(
    { occasions: [], colours: [], fabrics: [], sort: "newest" },
    limit,
  );
  return products.map(toProductCard);
}

export async function getFacets(category?: ProductCategory) {
  "use cache";
  cacheTag(PRODUCTS_TAG);
  cacheLife("hours");
  return queryFacets(category);
}

export async function getProduct(slug: string) {
  "use cache";
  cacheTag(PRODUCTS_TAG, productTag(slug));
  cacheLife("hours");
  return queryProductBySlug(slug);
}

export async function getRelatedProducts(category: ProductCategory, excludeSlug: string) {
  "use cache";
  cacheTag(PRODUCTS_TAG);
  cacheLife("hours");
  const rows = await queryRelated(category, excludeSlug, 4);
  return rows.map(toProductCard);
}

export async function getPublishedSlugs() {
  "use cache";
  cacheTag(PRODUCTS_TAG);
  cacheLife("hours");
  return queryPublishedSlugs();
}

export async function getCategoryCovers() {
  "use cache";
  cacheTag(PRODUCTS_TAG);
  cacheLife("hours");
  return queryCategoryCovers(categories.map((c) => c.value));
}
