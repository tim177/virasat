import "server-only";

import type { ProductCardData } from "@/components/ui/product-card";
import { getDb } from "@/lib/db";
import { en } from "@/lib/i18n/en";

/** Newest published products as product-card data. The full catalogue queries come in Step 4. */
export async function getNewestProducts(limit: number): Promise<ProductCardData[]> {
  const products = await getDb().product.findMany({
    where: { status: "published" },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      slug: true,
      title: true,
      fabric: true,
      work: true,
      priceCents: true,
      compareAtCents: true,
      customFitAvailable: true,
      images: { orderBy: { position: "asc" }, take: 1, select: { url: true, alt: true } },
    },
  });

  return products.map((product) => {
    const photo = product.images[0];
    return {
      href: `/p/${product.slug}`,
      title: product.title,
      subtitle: `${product.fabric} · ${product.work}`,
      image: photo ? { src: photo.url, alt: photo.alt } : null,
      priceCents: product.priceCents,
      compareAtCents: product.compareAtCents ?? undefined,
      badge: product.customFitAvailable ? en.catalog.customFitBadge : undefined,
    };
  });
}
