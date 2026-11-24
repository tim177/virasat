import * as Sentry from "@sentry/nextjs";

import { sentryDataCollection } from "@/lib/monitoring";

// Server-side monitoring. Sentry stays off until SENTRY_DSN is set in .env.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
      tracesSampleRate: 0.1,
      dataCollection: sentryDataCollection,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
