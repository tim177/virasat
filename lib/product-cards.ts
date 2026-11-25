import type { ProductCardData } from "@/components/ui/product-card";
import type { ProductCardRow } from "@/lib/catalog-queries";
import { en } from "@/lib/i18n/en";

/** Database row → the plain data a ProductCard shows. */
export function toProductCard(row: ProductCardRow): ProductCardData {
  const photo = row.images[0];
  return {
    href: `/p/${row.slug}`,
    title: row.title,
    subtitle: `${row.fabric} · ${row.work}`,
    image: photo ? { src: photo.url, alt: photo.alt } : null,
    priceCents: row.priceCents,
    compareAtCents: row.compareAtCents ?? undefined,
    badge: row.customFitAvailable ? en.catalog.customFitBadge : undefined,
  };
}
