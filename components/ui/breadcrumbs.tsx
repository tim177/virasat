import Link from "next/link";

import { cn } from "@/lib/cn";
import { en } from "@/lib/i18n/en";

import { ChevronRightIcon } from "./icons";

export type Crumb = { label: string; href?: string };

/** Breadcrumb trail. The last item is the current page. */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  const lastIndex = items.length - 1;

  return (
    <nav aria-label={en.ui.breadcrumb} className={className}>
      <ol className="flex flex-wrap items-center gap-x-1 text-body-sm text-stone-700">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-x-1">
            {index > 0 ? <ChevronRightIcon className="size-4 shrink-0" /> : null}
            {index < lastIndex && item.href ? (
              <Link
                href={item.href}
                className="inline-flex min-h-11 min-w-11 items-center underline-offset-4 hover:text-charcoal hover:underline"
              >
                {item.label}
              </Link>
            ) : (
              <span
                aria-current={index === lastIndex ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center",
                  index === lastIndex && "text-charcoal",
                )}
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
