import "server-only";

import { randomBytes } from "node:crypto";

import { z } from "zod";

import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { secretFromOtpauthUri, totpCode } from "@/lib/totp";

// Making admin accounts (scripts/create-admin.ts). Only someone with access to the server's
// database can do this; there is no admin sign-up page.

export const adminInputSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
  name: z.string().trim().min(1, "Enter a name").max(80),
  reset: z.boolean().default(false),
  /** Leave out for a random password (the normal case). Set for the local dev admin. */
  password: z
    .string()
    .min(12, "The password needs at least 12 characters")
    .max(128, "The password can have at most 128 characters")
    .optional(),
});

export type AdminInput = z.input<typeof adminInputSchema>;

export type NewAdminCredentials = {
  email: string;
  password: string;
  /** Base32 secret for the authenticator app (also inside otpauthUri). */
  totpSecret: string;
  otpauthUri: string;
  backupCodes: string[];
};

export class AdminAccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminAccountError";
  }
}

/** Cookie header ("a=1; b=2") from a response's Set-Cookie headers. */
function cookieHeader(headers: Headers): string {
  return headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

/**
 * Creates an admin with a new password (random unless given) and authenticator secret, with two-factor
 * sign-in already on. With `reset`, replaces an existing admin's password, authenticator
 * and backup codes, and signs them out everywhere.
 */
export async function createAdmin(rawInput: AdminInput): Promise<NewAdminCredentials> {
  const input = adminInputSchema.parse(rawInput);
  const db = getDb();
  const auth = getAuth();
  const ctx = await auth.$context;

  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing && !input.reset) {
    throw new AdminAccountError(`${input.email} already exists. Add --reset to replace its login.`);
  }
  if (existing && existing.role !== "admin") {
    throw new AdminAccountError(`${input.email} is a customer account, not an admin.`);
  }

  const password = input.password ?? randomBytes(18).toString("base64url");
  const passwordHash = await ctx.password.hash(password);

  const userId = await db.$transaction(async (tx) => {
    if (existing) {
      await tx.session.deleteMany({ where: { userId: existing.id } });
      await tx.twoFactor.deleteMany({ where: { userId: existing.id } });
      await tx.account.deleteMany({ where: { userId: existing.id, providerId: "credential" } });
      await tx.user.update({
        where: { id: existing.id },
        data: { name: input.name, twoFactorEnabled: false },
      });
    }
    const user =
      existing ??
      (await tx.user.create({
        data: { email: input.email, name: input.name, emailVerified: true, role: "admin" },
      }));
    await tx.account.create({
      data: {
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password: passwordHash,
      },
    });
    return user.id;
  });

  // Turn on two-factor the same way the app checks it: sign in once with the password, add
  // the authenticator, confirm it with a real code, then drop that session.
  try {
    const signIn = await auth.api.signInEmail({
      body: { email: input.email, password },
      returnHeaders: true,
    });
    const headers = new Headers({ cookie: cookieHeader(signIn.headers) });
    const enabled = await auth.api.enableTwoFactor({ body: { password }, headers });
    if (enabled.method !== "totp") throw new Error("Expected an authenticator (TOTP) secret");
    const { totpURI, backupCodes } = enabled;
    const totpSecret = secretFromOtpauthUri(totpURI);
    await auth.api.verifyTOTP({ body: { code: totpCode(totpSecret) }, headers });

    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorEnabled) throw new Error("Two-factor sign-in did not turn on");
    return { email: input.email, password, totpSecret, otpauthUri: totpURI, backupCodes };
  } catch (error) {
    // Never leave a new admin that could sign in with only a password.
    if (!existing) await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    throw error;
  } finally {
    await db.session.deleteMany({ where: { userId } });
  }
}
