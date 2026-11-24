import { cn } from "@/lib/cn";

/**
 * Grey loading block. Purely visual: the loading area itself should carry
 * `aria-busy="true"` or a visually hidden "Loading" status for screen readers.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-card bg-sand", className)} />;
}

/** A few lines of placeholder text. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className={cn("h-4 animate-pulse rounded-card bg-sand", i === lines - 1 && "w-2/3")}
        />
      ))}
    </div>
  );
}
