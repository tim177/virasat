import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "gold" | "ghost" | "link";
export type ButtonSize = "md" | "lg";

export type ButtonStyleOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-card font-medium transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60";

const variants: Record<ButtonVariant, string> = {
  // Main action on light surfaces.
  primary: "bg-crimson-700 text-white hover:bg-crimson-800",
  // Second action next to a primary button.
  secondary: "border border-charcoal bg-white text-charcoal hover:bg-sand",
  // Main action on dark surfaces only.
  gold: "bg-gold-400 text-charcoal hover:bg-ivory",
  // Low-emphasis action.
  ghost: "bg-transparent text-charcoal hover:bg-sand",
  // Looks like a link, still a 44px target.
  link: "bg-transparent text-crimson-700 underline underline-offset-4 hover:text-crimson-800",
};

// Every size is at least 44px tall (WCAG target size, and our own rule).
const sizes: Record<ButtonSize, string> = {
  md: "min-h-11 px-5 text-body",
  lg: "min-h-13 px-7 text-body-lg",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: ButtonStyleOptions = {}): string {
  const sizeClass = variant === "link" ? "min-h-11 text-body" : sizes[size];
  return cn(base, sizeClass, variants[variant], fullWidth && "w-full", className);
}
