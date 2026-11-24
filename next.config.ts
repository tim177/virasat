import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

// Product photos are either local files (/seed/... sample artwork) or uploads on the images
// domain (Cloudflare R2), e.g. IMAGES_BASE_URL=https://images.example.com. Nothing else is
// allowed through the image optimizer.
const imagesBaseUrl = process.env.IMAGES_BASE_URL?.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: imagesBaseUrl ? [new URL(`${imagesBaseUrl}/**`)] : [],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// Source maps are only uploaded to Sentry when SENTRY_AUTH_TOKEN is set (production builds).
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
