// Browser-side monitoring and analytics. Each SDK is loaded only when its key was set at build
// time: without keys the bundler drops them completely, so shoppers never download ~200 KB of
// unused JavaScript. With keys they load in the background and don't block the page.
// The cookie/consent approach for PostHog is decided in Step 8 (see the v1 spec).

import { sentryDataCollection } from "@/lib/monitoring";

type RouterTransitionHandler = (
  url: string,
  navigationType: "push" | "replace" | "traverse",
) => void;
let sentryTransition: RouterTransitionHandler | undefined;

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
        tracesSampleRate: 0.1,
        dataCollection: sentryDataCollection,
      });
      sentryTransition = Sentry.captureRouterTransitionStart;
    })
    .catch((error) => console.error("Sentry failed to start", error));
}

if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
        defaults: "2026-08-30",
        person_profiles: "identified_only",
      });
    })
    .catch((error) => console.error("PostHog failed to start", error));
}

export function onRouterTransitionStart(
  url: string,
  navigationType: "push" | "replace" | "traverse",
) {
  sentryTransition?.(url, navigationType);
}
