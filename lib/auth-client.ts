"use client";

import { createAuthClient } from "better-auth/client";
import { twoFactorClient } from "better-auth/client/plugins";

// Browser side of Better Auth (lib/auth.ts). Talks to /api/auth/* on the same site.
export const authClient = createAuthClient({ plugins: [twoFactorClient()] });
