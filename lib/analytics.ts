// One place for analytics events, so names stay consistent (see the v2 spec's event list).
// Does nothing until NEXT_PUBLIC_POSTHOG_KEY is set at build time; without it, PostHog isn't
// even part of the page's JavaScript. Call only from the browser.

export type AnalyticsEvent =
  | "view_item_list"
  | "view_item"
  | "search"
  | "search_no_results"
  | "add_to_cart"
  | "begin_checkout"
  | "purchase"
  | "login"
  | "sign_up"
  | "measurement_started"
  | "measurement_completed";

export type AnalyticsProperties = Record<string, string | number | boolean | string[] | null>;

export function track(event: AnalyticsEvent, properties: AnalyticsProperties = {}): void {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  if (typeof window === "undefined") return;
  import("posthog-js")
    .then(({ default: posthog }) => posthog.capture(event, properties))
    .catch(() => {
      // Analytics must never break the shop.
    });
}
