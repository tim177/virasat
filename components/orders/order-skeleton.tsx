import { Skeleton } from "@/components/ui/skeleton";
import { en } from "@/lib/i18n/en";

/** Loading state for an order page. */
export function OrderSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <p className="sr-only">{en.ui.loading}</p>
      <Skeleton className="h-12 w-1/2" />
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
