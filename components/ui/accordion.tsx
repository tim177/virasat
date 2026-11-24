import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { ChevronDownIcon } from "./icons";

export type AccordionItem = { title: string; content: ReactNode; defaultOpen?: boolean };

/**
 * Expandable sections built on native <details>/<summary>: keyboard and screen-reader
 * support come from the browser, and it works without JavaScript.
 */
export function Accordion({ items, className }: { items: AccordionItem[]; className?: string }) {
  return (
    <div className={cn("border-t border-line", className)}>
      {items.map((item) => (
        <details key={item.title} open={item.defaultOpen} className="group border-b border-line">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
            {item.title}
            <ChevronDownIcon className="size-5 shrink-0 transition-transform duration-200 ease-out group-open:rotate-180" />
          </summary>
          <div className="pb-5 text-stone-700">{item.content}</div>
        </details>
      ))}
    </div>
  );
}
