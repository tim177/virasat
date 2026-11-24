import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Friendly message for empty lists and pages ("Your bag is empty"), with an optional action. */
export function EmptyState({
  title,
  description,
  action,
  headingLevel = 2,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <div className={cn("flex flex-col items-center gap-4 px-4 py-12 text-center", className)}>
      <div aria-hidden="true" className="h-24 w-16 rounded-arch bg-jaali" />
      <Heading className="font-display text-h3">{title}</Heading>
      {description ? <p className="max-w-md text-stone-700">{description}</p> : null}
      {action}
    </div>
  );
}
