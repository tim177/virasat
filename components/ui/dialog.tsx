"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { en } from "@/lib/i18n/en";

import { IconButton } from "./icon-button";
import { CloseIcon } from "./icons";

type DialogVariant = "modal" | "drawer";

type DialogProps = {
  open: boolean;
  /** Called when the dialog closes for any reason: Escape, the close button or the backdrop. */
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  variant?: DialogVariant;
};

const variants: Record<DialogVariant, string> = {
  modal: "m-auto max-h-[85dvh] w-[min(100%-2rem,36rem)] rounded-field open:animate-dialog-in",
  drawer: "my-0 mr-auto ml-0 h-dvh max-h-none w-[min(100%-3rem,24rem)] open:animate-drawer-in-left",
};

/**
 * Built on the native <dialog> element opened with showModal(): the browser keeps focus
 * inside, makes the page behind inert, and closes it with Escape. We add focus return to the
 * element that opened it, backdrop click to close, and closing when the component unmounts
 * or its route is hidden.
 */
export function Dialog({ open, onClose, title, children, footer, variant = "modal" }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // Keep the onClose callback current without re-subscribing listeners.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      onCloseRef.current();
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    };
    dialog.addEventListener("close", handleClose);
    return () => {
      dialog.removeEventListener("close", handleClose);
      // If the route is hidden or the component unmounts while open, don't leave the page inert.
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className={cn(
        "bg-white p-0 text-charcoal shadow-overlay backdrop:bg-charcoal/50",
        variants[variant],
      )}
      onClick={(event) => {
        // A click on the dialog element itself (not its content) is a click on the backdrop.
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
    >
      <div className="flex h-full max-h-[inherit] flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-line py-2 pr-2 pl-5">
          <h2 id={titleId} className="font-display text-h3">
            {title}
          </h2>
          <IconButton label={en.ui.close} onClick={() => dialogRef.current?.close()}>
            <CloseIcon />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer ? <div className="border-t border-line px-5 py-4">{footer}</div> : null}
      </div>
    </dialog>
  );
}
