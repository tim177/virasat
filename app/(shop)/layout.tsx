import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { en } from "@/lib/i18n/en";

// Layout for every customer-facing page. The admin area (Step 6) gets its own layout.
export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-card focus:bg-white focus:px-4 focus:py-3 focus:shadow-overlay"
      >
        {en.nav.skipToContent}
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col focus:outline-none">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
