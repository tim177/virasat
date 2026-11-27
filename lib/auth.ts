import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { symmetricDecrypt } from "better-auth/crypto";
import { captcha } from "better-auth/plugins/captcha";
import { emailOTP } from "better-auth/plugins/email-otp";
import { twoFactor } from "better-auth/plugins/two-factor";

import { adminMayGetSessionFrom } from "@/lib/admin-access";
import { getDb } from "@/lib/db";
import { devVerificationCode } from "@/lib/dev-code";
import { googleLoginKeys, turnstileKeys } from "@/lib/login-config";
import { LOGIN_CODE_MINUTES, sendLoginCode } from "@/lib/login-emails";
import { siteUrl } from "@/lib/site-url";
import { base32Decode, totpCodeFromKey } from "@/lib/totp";

// Login (Better Auth).
// - Admins: email + password, then an authenticator code (TOTP). Nobody can sign up as an
//   admin; `pnpm admin:create` makes admin accounts.
// - Customers: a 6-digit code by email, or Google. The first sign-in creates the account
//   (role "customer"). Customers have no password.

/** Email-code endpoints we don't use. Password resets by email code would reach admin accounts. */
const UNUSED_PATHS = [
  "/email-otp/request-password-reset",
  "/forget-password/email-otp",
  "/email-otp/reset-password",
  "/email-otp/verify-email",
  "/email-otp/check-verification-otp",
  "/email-otp/request-email-change",
  "/email-otp/change-email",
];

/** Login steps that need a Turnstile token (when Turnstile is set up). */
const TURNSTILE_PATHS = ["/sign-in/email", "/email-otp/send-verification-otp"];

export const ADMIN_SIGN_IN_REQUIRED = "ADMIN_SIGN_IN_REQUIRED";

async function userRole(userId: string): Promise<string | null> {
  const user = await getDb().user.findUnique({ where: { id: userId }, select: { role: true } });
  return user?.role ?? null;
}

type HookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

/**
 * Local development only (DEV_VERIFICATION_CODE): the real authenticator code for the admin
 * who is halfway through signing in, so the dev code can stand in for it.
 */
async function currentCodeForPendingAdmin(ctx: HookContext): Promise<string | null> {
  const cookie = ctx.context.createAuthCookie("two_factor");
  const pendingId = await ctx.getSignedCookie(cookie.name, ctx.context.secret);
  if (!pendingId) return null;
  const pending = await ctx.context.internalAdapter.findVerificationValue(pendingId);
  if (!pending) return null;
  const row = await getDb().twoFactor.findUnique({
    where: { userId: pending.value },
    select: { secret: true },
  });
  if (!row) return null;
  const secret = await symmetricDecrypt({ key: ctx.context.secretConfig, data: row.secret });
  const key = secret.startsWith("base32:")
    ? base32Decode(secret.slice("base32:".length))
    : Buffer.from(secret, "utf8");
  return totpCodeFromKey(key);
}

function createAuth() {
  const google = googleLoginKeys();
  const turnstile = turnstileKeys();

  return betterAuth({
    appName: "Virasat",
    baseURL: siteUrl,
    secret: process.env.BETTER_AUTH_SECRET,
    // Better Auth's default (no interactive transactions): with them, a sign-in could stall
    // under load waiting for a database connection inside the transaction.
    database: prismaAdapter(getDb(), { provider: "postgresql" }),
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12 },
    socialProviders: google
      ? {
          google: {
            clientId: google.clientId,
            clientSecret: google.clientSecret,
            prompt: "select_account",
          },
        }
      : undefined,
    user: {
      additionalFields: {
        role: { type: "string", required: false, defaultValue: "customer", input: false },
      },
    },
    disabledPaths: UNUSED_PATHS,
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        // Email codes are only for signing in (no password resets or email changes).
        if (ctx.path === "/email-otp/send-verification-otp" && ctx.body?.type !== "sign-in") {
          throw new APIError("BAD_REQUEST", { message: "Only sign-in codes are supported" });
        }
        // Local development: DEV_VERIFICATION_CODE works as the admin's authenticator code.
        if (ctx.path === "/two-factor/verify-totp") {
          const devCode = devVerificationCode();
          if (devCode && ctx.body?.code === devCode) {
            const code = await currentCodeForPendingAdmin(ctx);
            if (code) return { context: { body: { ...ctx.body, code } } };
          }
        }
      }),
    },
    databaseHooks: {
      user: {
        // Accounts made by Better Auth (email code, Google) are always customers. Admins are
        // only made by `pnpm admin:create`, which writes to the database directly.
        create: { before: async (user) => ({ data: { ...user, role: "customer" } }) },
      },
      account: {
        // Google can't be linked to an admin account.
        create: {
          before: async (account) => {
            if (account.providerId === "credential") return;
            if ((await userRole(account.userId)) === "admin") return false;
          },
        },
      },
      session: {
        // An admin account only gets a session through password + authenticator code.
        create: {
          before: async (session, ctx) => {
            if ((await userRole(session.userId)) !== "admin") return;
            if (adminMayGetSessionFrom(ctx?.path)) return;
            throw new APIError("FORBIDDEN", {
              message: "Team accounts sign in at /admin/login",
              code: ADMIN_SIGN_IN_REQUIRED,
            });
          },
        },
      },
    },
    // Built-in limits (on in production): 3 tries per 10 seconds on /two-factor/*, plus a
    // 15-minute lock after 10 wrong codes. Email codes: 5 per minute per IP, and at most 5
    // emails per address per 15 minutes (lib/login-emails.tsx).
    rateLimit: {
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/email-otp/send-verification-otp": { window: 60, max: 5 },
        "/sign-in/email-otp": { window: 60, max: 10 },
      },
    },
    advanced: {
      // Ids come from the database schema (UUID v7), like every other table.
      database: { generateId: false },
      // Same client-IP order as lib/rate-limit.ts (Cloudflare first).
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"] },
    },
    plugins: [
      twoFactor({ issuer: "Virasat" }),
      emailOTP({
        otpLength: 6,
        expiresIn: LOGIN_CODE_MINUTES * 60,
        allowedAttempts: 5,
        // Only a hash is stored, so a database copy can't be used to sign in.
        storeOTP: "hashed",
        // In local development the code is DEV_VERIFICATION_CODE (lib/dev-code.ts); anywhere
        // else Better Auth makes a random one.
        generateOTP: ({ type }) =>
          type === "sign-in" ? (devVerificationCode() ?? undefined) : undefined,
        sendVerificationOTP: async ({ email, otp, type }) => {
          if (type !== "sign-in") return;
          // Not awaited, so the response takes the same time whether or not the address has
          // an account. sendLoginCode never throws.
          void sendLoginCode(email, otp);
        },
      }),
      ...(turnstile
        ? [
            captcha({
              provider: "cloudflare-turnstile",
              secretKey: turnstile.secretKey,
              endpoints: TURNSTILE_PATHS,
            }),
          ]
        : []),
    ],
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
