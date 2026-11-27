"use client";

import { createAuthClient } from "better-auth/client";
import { emailOTPClient, twoFactorClient } from "better-auth/client/plugins";

// Browser side of Better Auth (lib/auth.ts). Talks to /api/auth/* on the same site.
export const authClient = createAuthClient({ plugins: [twoFactorClient(), emailOTPClient()] });

/** Request options that carry a Turnstile token (when Turnstile is on). */
export function withTurnstile(token: string | null) {
  return token ? { headers: { "x-captcha-response": token } } : undefined;
}
