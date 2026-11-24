import { cn } from "@/lib/cn";
import { en } from "@/lib/i18n/en";
import { formatCents } from "@/lib/money";

type PriceSize = "sm" | "md" | "lg";

const sizes: Record<PriceSize, string> = {
  sm: "text-body-sm",
  md: "text-body",
  lg: "text-h3",
};

/**
 * Shows a price from integer cents, with tabular figures. If `compareAtCents` is higher,
 * shows a sale price and the struck-through original, both labelled for screen readers.
 */
export function Price({
  cents,
  compareAtCents,
  size = "md",
  className,
}: {
  cents: number;
  compareAtCents?: number;
  size?: PriceSize;
  className?: string;
}) {
  const onSale = compareAtCents !== undefined && compareAtCents > cents;

  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-baseline gap-x-2 tabular-nums",
        sizes[size],
        className,
      )}
    >
      {onSale ? (
        <>
          <span className="sr-only">{en.ui.salePrice}</span>
          <span className="font-medium text-crimson-700">{formatCents(cents)}</span>
          <span className="sr-only">{en.ui.originalPrice}</span>
          <s className="text-[0.875em] text-stone-700">{formatCents(compareAtCents)}</s>
        </>
      ) : (
        <span className="font-medium">{formatCents(cents)}</span>
      )}
    </span>
  );
}
