import { defineConfig, devices } from "@playwright/test";

const port = 3000;
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
    command: isCI ? "pnpm start" : "pnpm dev",
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
