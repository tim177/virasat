"use client";

import type { ButtonHTMLAttributes } from "react";

import { en } from "@/lib/i18n/en";

import { buttonClasses, type ButtonStyleOptions } from "./button-styles";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  Omit<ButtonStyleOptions, "className"> & {
    /** Shows a spinner and ignores clicks, but keeps focus on the button (unlike `disabled`). */
    loading?: boolean;
  };

export function Button({
  variant,
  size,
  fullWidth,
  loading = false,
  className,
  type = "button",
  onClick,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={buttonClasses({ variant, size, fullWidth, className })}
      aria-busy={loading || undefined}
      aria-disabled={loading || rest["aria-disabled"] || undefined}
      onClick={(event) => {
        if (loading) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {loading ? (
        <>
          <Spinner />
          <span className="sr-only">{en.ui.loading}</span>
        </>
      ) : null}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <svg
      className="size-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
