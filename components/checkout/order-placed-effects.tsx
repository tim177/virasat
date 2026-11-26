"use client";

import { useEffect } from "react";

import { track } from "@/lib/analytics";
import { clearBag } from "@/lib/bag-store";

/** Once the order exists: empty the bag and record the purchase (once per order). */
export function OrderPlacedEffects({
  orderNumber,
  totalCents,
}: {
  orderNumber: string;
  totalCents: number;
}) {
  useEffect(() => {
    clearBag();
    const key = `virasat:purchase-tracked:${orderNumber}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // Storage blocked: tracking twice is better than crashing.
    }
    track("purchase", { order: orderNumber, value_cents: totalCents, currency: "USD" });
  }, [orderNumber, totalCents]);
  return null;
}
