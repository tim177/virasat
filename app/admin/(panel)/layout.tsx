import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { getAdmin } from "@/lib/admin-auth";
import { en } from "@/lib/i18n/en";

// Every admin screen except the login page. Each page still calls requireAdmin() itself:
// layouts don't re-run on every navigation, so they can't be the security check.
export default function AdminPanelLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-card focus:bg-white focus:px-4 focus:py-3 focus:shadow-overlay"
      >
        {en.nav.skipToContent}
      </a>
      <header className="border-b border-line bg-white">
        <div className="page-container flex min-h-16 flex-wrap items-center justify-between gap-x-6 gap-y-2 py-2">
          <div className="flex items-center gap-6">
            <Link
              href="/admin"
              className="inline-flex min-h-11 items-center font-display text-body-lg"
            >
              {en.admin.brand}
            </Link>
            <nav aria-label={en.admin.nav}>
              <ul className="flex gap-4 text-body-sm">
                <li>
                  <Link href="/admin" className="inline-flex min-h-11 items-center hover:underline">
                    {en.admin.dashboard}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/admin/orders"
                    className="inline-flex min-h-11 items-center hover:underline"
                  >
                    {en.admin.ordersNav}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/admin/products"
                    className="inline-flex min-h-11 items-center hover:underline"
                  >
                    {en.admin.productsNav}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/admin/log"
                    className="inline-flex min-h-11 items-center hover:underline"
                  >
                    {en.admin.logNav}
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
          <Suspense fallback={null}>
            <SignedInAs />
          </Suspense>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="page-container flex-1 py-8 focus:outline-none">
        {children}
      </main>
    </>
  );
}

async function SignedInAs() {
  const admin = await getAdmin();
  if (!admin) return null;
  return (
    <div className="flex items-center gap-3 text-body-sm text-stone-700">
      <span>{en.admin.signedInAs(admin.name)}</span>
      <SignOutButton label={en.admin.signOut} redirectTo="/admin/login" />
    </div>
  );
}
