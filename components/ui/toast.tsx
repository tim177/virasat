"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/cn";
import { en } from "@/lib/i18n/en";

import { IconButton } from "./icon-button";
import { AlertCircleIcon, CheckIcon, CloseIcon, InfoIcon } from "./icons";

export type ToastTone = "info" | "success" | "error";

type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Optional link, e.g. "View bag". */
  action?: { label: string; href: string };
};
type ToastItem = ToastInput & { id: number; tone: ToastTone };

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

const AUTO_DISMISS_MS = 6000;
const MAX_VISIBLE = 3;

/** Wrap the app once (in the root layout). Then call `useToast()` anywhere to show a message. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((input: ToastInput) => {
    nextId.current += 1;
    const item: ToastItem = { ...input, tone: input.tone ?? "info", id: nextId.current };
    setToasts((current) => [...current.slice(-(MAX_VISIBLE - 1)), item]);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* The live region exists before any toast appears, so new toasts are announced. */}
      <section
        aria-label={en.ui.notifications}
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </section>
    </ToastContext.Provider>
  );
}

export function useToast(): (toast: ToastInput) => void {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast must be used inside <ToastProvider>");
  return show;
}

const toneStyles: Record<ToastTone, { icon: ReactNode; className: string }> = {
  info: { icon: <InfoIcon className="size-5 text-info" />, className: "border-info" },
  success: {
    icon: <CheckIcon className="size-5 text-emerald-700" />,
    className: "border-emerald-700",
  },
  error: { icon: <AlertCircleIcon className="size-5 text-error" />, className: "border-error" },
};

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  // Hovering or focusing the toast pauses the timer, so it can be read at any pace.
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [paused, onDismiss]);

  const tone = toneStyles[toast.tone];

  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-field border-l-4 bg-white py-2 pr-2 pl-4 shadow-overlay",
        tone.className,
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="mt-2.5 shrink-0">{tone.icon}</span>
      <div className="flex-1 py-2">
        <p className="font-medium">{toast.title}</p>
        {toast.description ? (
          <p className="text-body-sm text-stone-700">{toast.description}</p>
        ) : null}
        {toast.action ? (
          <Link
            href={toast.action.href}
            onClick={onDismiss}
            className="mt-1 inline-flex min-h-11 items-center font-medium text-crimson-700 underline underline-offset-4 hover:text-crimson-800"
          >
            {toast.action.label}
          </Link>
        ) : null}
      </div>
      <IconButton label={en.ui.dismissNotification} onClick={onDismiss}>
        <CloseIcon className="size-5" />
      </IconButton>
    </div>
  );
}
