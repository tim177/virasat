"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { en } from "@/lib/i18n/en";

const POLL_MS = 2000;
const MAX_ATTEMPTS = 20; // about 40 seconds

/**
 * Shown when the customer arrives before Stripe's webhook has created the order.
 * Re-renders the page every 2 seconds until the order appears.
 */
export function AwaitingOrder() {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  const givenUp = attempts >= MAX_ATTEMPTS;

  useEffect(() => {
    if (givenUp) return;
    const timer = window.setTimeout(() => {
      setAttempts((n) => n + 1);
      router.refresh();
    }, POLL_MS);
    return () => window.clearTimeout(timer);
  }, [attempts, givenUp, router]);

  return (
    <div role="status" className="flex flex-col items-center gap-3 py-16 text-center">
      {givenUp ? (
        <>
          <h1 className="font-display text-h2">{en.checkout.slowTitle}</h1>
          <p className="max-w-md text-stone-700">{en.checkout.slowText}</p>
        </>
      ) : (
        <>
          <span
            aria-hidden="true"
            className="size-8 animate-spin rounded-pill border-2 border-line border-t-crimson-700"
          />
          <h1 className="font-display text-h2">{en.checkout.confirming}</h1>
          <p className="max-w-md text-stone-700">{en.checkout.confirmingText}</p>
        </>
      )}
    </div>
  );
}
