import "dotenv/config";

import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const root = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// Unit tests (tests/unit) need nothing else. Integration tests (tests/integration) need the
// local database running and seeded: pnpm db:up && pnpm db:seed.
export default defineConfig({
  resolve: {
    alias: {
      "@": root("."),
      // Next.js handles `import "server-only"` itself; outside Next it's an empty module.
      "server-only": root("tests/stubs/server-only.ts"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
