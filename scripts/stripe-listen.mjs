// Forwards Stripe webhooks to your laptop: `pnpm stripe:listen` (or `pnpm stripe:listen 3300`).
// Uses STRIPE_SECRET_KEY from .env, so events come from the same Stripe account the app uses,
// whatever account the Stripe CLI happens to be logged into.
import "dotenv/config";

import { spawn } from "node:child_process";

const key = process.env.STRIPE_SECRET_KEY;
if (!key?.startsWith("sk_test_")) {
  console.error("STRIPE_SECRET_KEY in .env must be a test key (sk_test_...).");
  process.exit(1);
}

const port = process.argv[2] ?? "3000";
const events = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "charge.refunded",
].join(",");

const child = spawn(
  "stripe",
  [
    "listen",
    "--api-key",
    key,
    "--events",
    events,
    "--forward-to",
    `localhost:${port}/api/stripe/webhook`,
  ],
  { stdio: "inherit", shell: process.platform === "win32" },
);
child.on("exit", (code) => process.exit(code ?? 0));
