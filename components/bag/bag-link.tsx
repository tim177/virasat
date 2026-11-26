"use client";

import Link from "next/link";

import { iconButtonClasses } from "@/components/ui/icon-button";
import { BagIcon } from "@/components/ui/icons";
import { bagItemCount, useBag } from "@/lib/bag-store";
import { en } from "@/lib/i18n/en";

/** Header bag icon with the number of pieces in the bag. */
export function BagLink() {
  const count = bagItemCount(useBag());
  return (
    <Link
      href="/bag"
      aria-label={en.bag.link(count)}
      className={iconButtonClasses("ghost", "relative")}
    >
      <BagIcon />
      {count > 0 ? (
        <span
          aria-hidden="true"
          className="absolute top-0.5 right-0.5 flex h-5 min-w-5 items-center justify-center rounded-pill bg-crimson-700 px-1 text-caption font-medium text-white tabular-nums"
        >
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Link>
  );
}
