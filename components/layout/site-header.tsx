import Link from "next/link";

import { IconLink } from "@/components/ui/icon-button";
import { BagIcon, SearchIcon, UserIcon } from "@/components/ui/icons";
import { en } from "@/lib/i18n/en";
import { shopCategories } from "@/lib/site";

import { MobileNav } from "./mobile-nav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40">
      <div className="surface-dark bg-charcoal text-ivory">
        <p className="page-container py-2 text-center text-caption tracking-wide">
          {en.site.trustBar}
        </p>
      </div>

      <div className="border-b border-line bg-white">
        <div className="page-container flex h-16 items-center gap-1 lg:h-20">
          <MobileNav />

          <Link
            href="/"
            aria-label={en.site.homeLink}
            className="inline-flex min-h-11 items-center px-1 font-display text-h3 font-medium tracking-wide lg:text-h2"
          >
            {en.site.name}
          </Link>

          <nav aria-label={en.nav.mainLabel} className="mx-auto hidden lg:block">
            <ul className="flex items-center gap-1">
              {shopCategories.map((category) => (
                <li key={category.href}>
                  <Link
                    href={category.href}
                    className="inline-flex min-h-11 items-center px-3 text-body-sm font-medium tracking-wide uppercase transition-colors duration-150 hover:text-crimson-700"
                  >
                    {category.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ml-auto flex items-center lg:ml-0">
            <IconLink href="/search" label={en.nav.search}>
              <SearchIcon />
            </IconLink>
            <IconLink href="/account" label={en.nav.account} className="hidden sm:inline-flex">
              <UserIcon />
            </IconLink>
            {/* The bag count arrives with the bag in Step 5. */}
            <IconLink href="/bag" label={en.nav.bag}>
              <BagIcon />
            </IconLink>
          </div>
        </div>
      </div>
    </header>
  );
}
