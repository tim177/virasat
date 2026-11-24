import type { Gender, Occasion, ProductCategory } from "@/lib/generated/prisma/enums";
import { en } from "@/lib/i18n/en";

// Shared catalogue vocabulary: database values ↔ URL slugs ↔ labels shown to shoppers.

export type CategoryInfo = { value: ProductCategory; slug: string; label: string };

/** Categories in menu order. `slug` is used in URLs: /c/{slug}. */
export const categories: readonly CategoryInfo[] = [
  { value: "lehenga", slug: "lehengas", label: en.categories.lehengas },
  { value: "saree", slug: "sarees", label: en.categories.sarees },
  { value: "anarkali", slug: "anarkalis", label: en.categories.anarkalis },
  { value: "sherwani", slug: "sherwanis", label: en.categories.sherwanis },
  { value: "kurta_set", slug: "kurta-sets", label: en.categories.kurtaSets },
];

export function categoryBySlug(slug: string): CategoryInfo | undefined {
  return categories.find((category) => category.slug === slug);
}

export function categoryByValue(value: ProductCategory): CategoryInfo {
  const category = categories.find((c) => c.value === value);
  if (!category) throw new Error(`Unknown category: ${value}`);
  return category;
}

export const occasionLabels: Record<Occasion, string> = en.catalog.occasions;

export const genderLabels: Record<Gender, string> = en.catalog.genders;
