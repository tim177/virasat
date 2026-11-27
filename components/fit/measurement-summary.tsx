import { cn } from "@/lib/cn";
import { en } from "@/lib/i18n/en";
import { describeMeasurements } from "@/lib/measurement-display";

/** Read-only measurements (admin order page, customer order pages, bag). */
export function MeasurementSummary({
  measurements,
  emptyText,
  className,
}: {
  measurements: unknown;
  emptyText: string;
  className?: string;
}) {
  const display = describeMeasurements(measurements);
  if (!display) return <p className={cn("text-stone-700", className)}>{emptyText}</p>;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {display.title ? <p className="text-stone-700">{display.title}</p> : null}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3" data-testid="measurements">
        {display.rows.map((row) => (
          <div key={row.key}>
            <dt className="text-stone-700">{row.label}</dt>
            <dd className="tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
      {display.notes ? (
        <p>
          <span className="text-stone-700">{en.fit.notesLabel}: </span>
          {display.notes}
        </p>
      ) : null}
    </div>
  );
}
