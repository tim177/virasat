import { cn } from "@/lib/cn";
import { en } from "@/lib/i18n/en";

import { CheckIcon } from "./icons";

/**
 * Numbered steps for multi-step forms (e.g. the custom-fit measurement form).
 * On small screens only the current step's label is shown; all labels stay available to
 * screen readers.
 */
export function Stepper({
  steps,
  current,
  className,
}: {
  steps: string[];
  /** Index of the current step, starting at 0. */
  current: number;
  className?: string;
}) {
  return (
    <nav aria-label={en.ui.progress} className={className}>
      <ol className="flex items-center gap-2">
        {steps.map((label, index) => {
          const done = index < current;
          const isCurrent = index === current;
          return (
            <li
              key={label}
              aria-current={isCurrent ? "step" : undefined}
              className="flex flex-1 items-center gap-2 last:flex-none"
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-pill border text-body-sm font-medium tabular-nums",
                  done && "border-emerald-700 bg-emerald-700 text-white",
                  isCurrent && "border-crimson-700 bg-crimson-700 text-white",
                  !done && !isCurrent && "border-stone-700 bg-white text-stone-700",
                )}
              >
                {done ? <CheckIcon className="size-4" /> : index + 1}
              </span>
              <span
                className={cn(
                  "text-body-sm",
                  isCurrent ? "font-medium text-charcoal" : "sr-only text-stone-700 sm:not-sr-only",
                )}
              >
                {label}
                {done ? <span className="sr-only"> ({en.ui.stepCompleted})</span> : null}
                {isCurrent ? <span className="sr-only"> ({en.ui.stepCurrent})</span> : null}
              </span>
              {index < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn("h-px min-w-4 flex-1", done ? "bg-emerald-700" : "bg-stone-700/40")}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export type TimelineItem = {
  label: string;
  state: "complete" | "current" | "upcoming";
  /** Already formatted for display, e.g. "Mar 3, 2027". */
  date?: string;
  description?: string;
};

const stateText: Record<TimelineItem["state"], string> = {
  complete: en.ui.timelineCompleted,
  current: en.ui.timelineCurrent,
  upcoming: en.ui.timelineUpcoming,
};

/** Vertical timeline, e.g. order status: Paid → Confirmed → In production → Shipped. */
export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn("flex flex-col", className)}>
      {items.map((item, index) => (
        <li key={`${item.label}-${index}`} className="relative flex gap-4 pb-6 last:pb-0">
          {index < items.length - 1 ? (
            <span
              aria-hidden="true"
              className={cn(
                "absolute top-7 bottom-1 left-[11px] w-0.5",
                item.state === "complete" ? "bg-emerald-700" : "bg-line",
              )}
            />
          ) : null}
          <span
            aria-hidden="true"
            className={cn(
              "relative mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-pill border-2",
              item.state === "complete" && "border-emerald-700 bg-emerald-700 text-white",
              item.state === "current" && "border-crimson-700 bg-white",
              item.state === "upcoming" && "border-line bg-white",
            )}
          >
            {item.state === "complete" ? (
              <CheckIcon className="size-3.5" strokeWidth={2.5} />
            ) : null}
            {item.state === "current" ? (
              <span className="size-2 rounded-pill bg-crimson-700" />
            ) : null}
          </span>
          <div className="flex flex-col">
            <p className={cn("font-medium", item.state === "upcoming" && "text-stone-700")}>
              {item.label}
              <span className="sr-only"> ({stateText[item.state]})</span>
            </p>
            {item.date ? <p className="text-body-sm text-stone-700">{item.date}</p> : null}
            {item.description ? <p className="mt-1 text-body-sm">{item.description}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
