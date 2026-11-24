"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { MenuIcon } from "@/components/ui/icons";
import { ZariRule } from "@/components/ui/ornament";
import { en } from "@/lib/i18n/en";
import { helpLinks, shopCategories } from "@/lib/site";

const linkClass =
  "flex min-h-12 items-center text-body-lg transition-colors duration-150 hover:text-crimson-700";

/** Menu button and slide-in drawer for small screens. Hidden from large screens up. */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer whenever the page changes (including browser back/forward).
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  // Also close if the screen grows past the breakpoint while the drawer is open.
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 64rem)");
    const handle = () => desktop.matches && setOpen(false);
    desktop.addEventListener("change", handle);
    return () => desktop.removeEventListener("change", handle);
  }, []);

  return (
    <div className="lg:hidden">
      <IconButton
        label={en.nav.openMenu}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <MenuIcon />
      </IconButton>

      <Dialog open={open} onClose={() => setOpen(false)} title={en.nav.menuTitle} variant="drawer">
        <nav aria-label={en.nav.mainLabel}>
          <ul>
            {shopCategories.map((category) => (
              <li key={category.href}>
                <Link href={category.href} className={linkClass} onClick={() => setOpen(false)}>
                  {category.label}
                </Link>
              </li>
            ))}
          </ul>
          <ZariRule className="my-5" />
          <ul>
            <li>
              <Link href="/account" className={linkClass} onClick={() => setOpen(false)}>
                {en.nav.account}
              </Link>
            </li>
            {helpLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={linkClass} onClick={() => setOpen(false)}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Dialog>
    </div>
  );
}
