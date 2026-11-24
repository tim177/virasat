import { en } from "@/lib/i18n/en";

export type NavLink = { href: string; label: string };

/** Shop categories, in menu order. Category pages arrive in Step 4. */
export const shopCategories: NavLink[] = [
  { href: "/c/lehengas", label: en.categories.lehengas },
  { href: "/c/sarees", label: en.categories.sarees },
  { href: "/c/anarkalis", label: en.categories.anarkalis },
  { href: "/c/sherwanis", label: en.categories.sherwanis },
  { href: "/c/kurta-sets", label: en.categories.kurtaSets },
];

/** Help and policy pages. These pages arrive in Step 8. */
export const helpLinks: NavLink[] = [
  { href: "/shipping-returns", label: en.pages.shippingReturns },
  { href: "/size-guide", label: en.pages.sizeGuide },
  { href: "/contact", label: en.pages.contact },
];

export const companyLinks: NavLink[] = [
  { href: "/about", label: en.pages.about },
  { href: "/privacy", label: en.pages.privacy },
  { href: "/terms", label: en.pages.terms },
];
