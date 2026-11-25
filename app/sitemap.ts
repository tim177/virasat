import type { MetadataRoute } from "next";

import { categories } from "@/lib/catalog";
import { getPublishedSlugs } from "@/lib/products";
import { absoluteUrl } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getPublishedSlugs();
  return [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/shop"), changeFrequency: "daily", priority: 0.8 },
    ...categories.map((category) => ({
      url: absoluteUrl(`/c/${category.slug}`),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...products.map((product) => ({
      url: absoluteUrl(`/p/${product.slug}`),
      lastModified: product.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
