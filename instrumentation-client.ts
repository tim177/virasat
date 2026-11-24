import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

import { sentryDataCollection } from "@/lib/monitoring";

// Browser-side monitoring and analytics. Each one stays off until its key is set in .env.
// The cookie/consent approach for PostHog is decided in Step 8 (see the v1 spec).

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (sentryDsn) {
  try {
    Sentry.init({
      dsn: sentryDsn,
      environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
      tracesSampleRate: 0.1,
      dataCollection: sentryDataCollection,
    });
  } catch (error) {
    console.error("Sentry failed to start", error);
  }
}

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (posthogKey) {
  try {
    posthog.init(posthogKey, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      defaults: "2026-08-30",
      person_profiles: "identified_only",
    });
  } catch (error) {
    console.error("PostHog failed to start", error);
  }
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
