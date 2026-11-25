"use client";

import { useSyncExternalStore } from "react";

// Today's date in the shopper's own time zone, for delivery estimates.
// Pages are prerendered on the server, where "today" would be the build date, so this returns
// null during server rendering and hydration, then the real date once the page is interactive.

let today: Date | null = null;

function getSnapshot(): Date {
  today ??= new Date();
  return today;
}

function getServerSnapshot(): null {
  return null;
}

function subscribe(): () => void {
  return () => {};
}

export function useToday(): Date | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
