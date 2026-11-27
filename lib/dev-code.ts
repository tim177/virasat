import { isLocalDatabaseUrl } from "@/lib/local-database";

// A fixed verification code for local development (DEV_VERIFICATION_CODE, e.g. "000000"), so
// signing in on a laptop needs no inbox or authenticator app. It works for customer email codes
// and for the admin authenticator step. Real codes keep working alongside it.
//
// It can never work in production: it is ignored when NODE_ENV is "production" (every `next
// start`, Docker image and server) or when the database isn't on this computer.

type Env = Record<string, string | undefined>;

/** The dev code if it's allowed here, otherwise null. Reads the environment on every call. */
export function devVerificationCode(env: Env = process.env): string | null {
  const code = env.DEV_VERIFICATION_CODE?.trim();
  if (!code || !/^\d{6}$/.test(code)) return null;
  if (env.NODE_ENV === "production") return null;
  if (!isLocalDatabaseUrl(env.DATABASE_URL)) return null;
  return code;
}
