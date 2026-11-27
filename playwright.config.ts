import { defineConfig, devices } from "@playwright/test";

// E2E_PORT lets tests run while your own `pnpm dev` keeps port 3000, e.g. E2E_PORT=3300.
const port = Number(process.env.E2E_PORT ?? 3000);
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    // CI tests the production build; locally we reuse the dev server if it's already running.
    command: isCI ? `pnpm start --port ${port}` : `pnpm dev --port ${port}`,
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    env: {
      // Stripe sends the customer back to SITE_URL after paying, so it must match this port.
      SITE_URL: `http://localhost:${port}`,
      // No Turnstile in browser tests, so they never depend on Cloudflare's servers. (Next.js
      // keeps these empty values instead of the keys in .env.)
      TURNSTILE_SITE_KEY: "",
      TURNSTILE_SECRET_KEY: "",
    },
  },
});
