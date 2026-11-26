import "server-only";

import { revalidateTag } from "next/cache";

import { PRODUCTS_TAG } from "@/lib/products";

/**
 * Marks cached shop pages as stale after stock or product changes. The next visit gets the
 * current page while a fresh one is built in the background ("max" profile).
 * Outside a Next.js request (tests, scripts) there's no cache, so this does nothing.
 */
export function refreshShop(): void {
  try {
    revalidateTag(PRODUCTS_TAG, "max");
  } catch {
    // Not running inside Next.js.
  }
}
