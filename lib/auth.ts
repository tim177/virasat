import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins/two-factor";

import { getDb } from "@/lib/db";
import { siteUrl } from "@/lib/site-url";

// Login (Better Auth). Step 6: admins sign in with email + password, then an authenticator
// code (TOTP). Nobody can sign up; `pnpm admin:create` makes admin accounts.
// Step 7 adds customer sign-in by email code and Google.
function createAuth() {
  return betterAuth({
    appName: "Virasat",
    baseURL: siteUrl,
    secret: process.env.BETTER_AUTH_SECRET,
    // Better Auth's default (no interactive transactions): with them, a sign-in could stall
    // under load waiting for a database connection inside the transaction.
    database: prismaAdapter(getDb(), { provider: "postgresql" }),
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12 },
    user: {
      additionalFields: {
        role: { type: "string", required: false, defaultValue: "customer", input: false },
      },
    },
    // Built-in limits (on in production): 3 tries per 10 seconds on /two-factor/*, plus a
    // 15-minute lock after 10 wrong codes.
    rateLimit: {
      window: 60,
      max: 100,
      customRules: { "/sign-in/email": { window: 60, max: 10 } },
    },
    advanced: {
      // Ids come from the database schema (UUID v7), like every other table.
      database: { generateId: false },
      // Same client-IP order as lib/rate-limit.ts (Cloudflare first).
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"] },
    },
    plugins: [twoFactor({ issuer: "Virasat" })],
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { auth?: Auth };

/** The shared auth instance. Created on first use, so builds don't need the secret. */
export function getAuth(): Auth {
  globalForAuth.auth ??= createAuth();
  return globalForAuth.auth;
}
