import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "error" | "info";

// Every pair here passes 4.5:1 text contrast (see tests/unit/design-tokens.test.ts).
const tones: Record<BadgeTone, string> = {
  neutral: "bg-sand text-charcoal",
  accent: "bg-crimson-50 text-crimson-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "border border-warning bg-white text-warning",
  error: "border border-error bg-white text-error",
  info: "border border-info bg-white text-info",
};

/** Small pill label, e.g. "Custom fit available" or "New". */
export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-caption font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A badge with a status dot, for order and payment states. */
export function StatusPill({
  tone = "neutral",
  label,
  className,
}: {
  tone?: BadgeTone;
  label: string;
  className?: string;
}) {
  return (
    <Badge tone={tone} className={className}>
      <span aria-hidden="true" className="size-1.5 rounded-pill bg-current" />
      {label}
    </Badge>
  );
}
