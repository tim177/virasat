import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";

import { cn } from "@/lib/cn";

export type IconButtonTone = "ghost" | "secondary" | "onDark";

const tones: Record<IconButtonTone, string> = {
  ghost: "text-charcoal hover:bg-sand",
  secondary: "border border-charcoal bg-white text-charcoal hover:bg-sand",
  onDark: "text-ivory hover:bg-white/10",
};

// No position class here: callers may pass `absolute` (e.g. gallery arrows) or `relative`
// (e.g. a bag count badge), and two position classes would fight.
export function iconButtonClasses(tone: IconButtonTone = "ghost", className?: string): string {
  return cn(
    "inline-flex size-11 shrink-0 items-center justify-center rounded-pill transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-60",
    tones[tone],
    className,
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Required: what the button does, read out by screen readers. */
  label: string;
  tone?: IconButtonTone;
};

/** A 44px round button showing only an icon. */
export function IconButton({
  label,
  tone,
  className,
  type = "button",
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button {...rest} type={type} aria-label={label} className={iconButtonClasses(tone, className)}>
      {children}
    </button>
  );
}

type IconLinkProps = ComponentProps<typeof Link> & { label: string; tone?: IconButtonTone };

/** A 44px round link showing only an icon. */
export function IconLink({ label, tone, className, children, ...rest }: IconLinkProps) {
  return (
    <Link {...rest} aria-label={label} className={iconButtonClasses(tone, className)}>
      {children}
    </Link>
  );
}
