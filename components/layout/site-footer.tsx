import Link from "next/link";

import { ZariRule } from "@/components/ui/ornament";
import { en } from "@/lib/i18n/en";
import { companyLinks, helpLinks, shopCategories, type NavLink } from "@/lib/site";

function FooterColumn({ heading, links }: { heading: string; links: NavLink[] }) {
  return (
    <nav aria-label={heading}>
      <h2 className="mb-2 text-caption font-medium tracking-widest uppercase">{heading}</h2>
      <ul>
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="inline-flex min-h-11 min-w-11 items-center text-body-sm underline-offset-4 hover:underline"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="surface-dark mt-16 bg-charcoal text-ivory">
      <div className="page-container py-12">
        <ZariRule className="mb-10" />
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-3">
            <p className="font-display text-h3">{en.site.name}</p>
            <p className="max-w-xs text-body-sm text-sand">{en.site.footerTagline}</p>
          </div>
          <FooterColumn heading={en.nav.shopHeading} links={shopCategories} />
          <FooterColumn heading={en.nav.helpHeading} links={helpLinks} />
          <FooterColumn heading={en.nav.aboutHeading} links={companyLinks} />
        </div>
        <p className="mt-10 text-caption text-sand">
          {en.site.copyright} · {en.site.trustBar}
        </p>
      </div>
    </footer>
  );
}
