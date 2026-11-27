"use client";

import { useSyncExternalStore } from "react";

import { bagSchema, MAX_BAG_LINES, MAX_QUANTITY, type BagLine } from "@/lib/bag-schema";
import type { MeasurementSet } from "@/lib/measurements";

// The shopping bag lives in the browser (localStorage), so it survives reloads and needs no
// account. It stores references only; prices are always fetched from the server.

const STORAGE_KEY = "virasat:bag:v1";
const EMPTY: BagLine[] = [];

let cache: BagLine[] | null = null;
const listeners = new Set<() => void>();

function read(): BagLine[] {
  if (cache) return cache;
  try {
    const parsed = bagSchema.safeParse(
      JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]"),
    );
    cache = parsed.success ? parsed.data : [];
  } catch {
    cache = []; // private mode or corrupted data: start with an empty bag
  }
  return cache;
}

function write(lines: BagLine[]): void {
  cache = lines;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Storage unavailable: the bag still works for this page view.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cache = null; // changed in another tab
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The bag's lines. Empty during server rendering; filled in once the page is interactive. */
export function useBag(): BagLine[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function bagItemCount(lines: BagLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

/** Adds one piece. Same size again → quantity +1; custom fit → always its own line. */
export function addToBag(item: {
  productSlug: string;
  variantId: string | null;
  custom: boolean;
  measurements?: MeasurementSet | null;
}): boolean {
  const lines = read();
  if (!item.custom) {
    const existing = lines.find(
      (line) =>
        !line.custom && line.productSlug === item.productSlug && line.variantId === item.variantId,
    );
    if (existing) {
      write(
        lines.map((line) =>
          line === existing
            ? { ...line, quantity: Math.min(MAX_QUANTITY, line.quantity + 1) }
            : line,
        ),
      );
      return true;
    }
  }
  if (lines.length >= MAX_BAG_LINES) return false;
  write([
    ...lines,
    {
      id: crypto.randomUUID(),
      productSlug: item.productSlug,
      variantId: item.custom ? null : item.variantId,
      custom: item.custom,
      quantity: 1,
      ...(item.custom ? { measurements: item.measurements ?? null } : {}),
    },
  ]);
  return true;
}

/** Saves the measurements for a custom-fit line ("Add/Edit measurements" in the bag). */
export function setLineMeasurements(id: string, measurements: MeasurementSet): void {
  write(read().map((line) => (line.id === id && line.custom ? { ...line, measurements } : line)));
}

export function setLineQuantity(id: string, quantity: number): void {
  const clamped = Math.max(1, Math.min(MAX_QUANTITY, Math.round(quantity)));
  write(read().map((line) => (line.id === id ? { ...line, quantity: clamped } : line)));
}

export function removeLine(id: string): void {
  write(read().filter((line) => line.id !== id));
}

export function clearBag(): void {
  write([]);
}
