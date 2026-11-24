import { cn } from "@/lib/cn";

/** "Zari rule" divider: a 1px gold line with a diamond knot in the middle. Decorative. */
export function ZariRule({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("flex items-center gap-3 text-gold-500", className)}>
      <span className="h-px flex-1 bg-current" />
      <span className="relative size-2.5 rotate-45 border border-current">
        <span className="absolute inset-[3px] bg-current" />
      </span>
      <span className="h-px flex-1 bg-current" />
    </div>
  );
}

/**
 * Jaali lattice surface: the placeholder for missing photos and photo-free areas.
 * Pass `label` when it stands in for meaningful content (it becomes an image for screen
 * readers); leave it out when it's purely decorative.
 */
export function Jaali({ label, className }: { label?: string; className?: string }) {
  if (label) {
    return <div role="img" aria-label={label} className={cn("bg-jaali", className)} />;
  }
  return <div aria-hidden="true" className={cn("bg-jaali", className)} />;
}
