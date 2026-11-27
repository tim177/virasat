// Who may open /admin. Pure, so the rule is unit-tested; lib/admin-auth.ts applies it to the
// session of each request.

/** Admins sign in again after this long, however active they are. */
export const ADMIN_SESSION_MAX_HOURS = 12;

export type Admin = { id: string; name: string; email: string };

type SessionLike = {
  session: { createdAt: Date | string };
  user: {
    id: string;
    name: string;
    email: string;
    role?: string | null;
    twoFactorEnabled?: boolean | null;
  };
} | null;

/**
 * The only sign-in steps that may create a session for an admin account: the password step
 * (the two-factor plugin swaps that session for an authenticator challenge at once) and the
 * authenticator or backup-code step. Customer sign-ins (email code, Google) can't, because the
 * two-factor plugin doesn't guard them and adminFromSession can't tell how a session was made.
 */
const ADMIN_SIGN_IN_PATHS = new Set([
  "/sign-in/email",
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
]);

export function adminMayGetSessionFrom(path: string | null | undefined): boolean {
  return typeof path === "string" && ADMIN_SIGN_IN_PATHS.has(path);
}

/**
 * The admin behind a session, or null. An admin has role "admin", has two-factor sign-in on
 * (so every sign-in needed an authenticator code), and signed in less than 12 hours ago.
 */
export function adminFromSession(session: SessionLike, now: Date): Admin | null {
  if (!session) return null;
  const { user } = session;
  if (user.role !== "admin" || user.twoFactorEnabled !== true) return null;
  const ageMs = now.getTime() - new Date(session.session.createdAt).getTime();
  if (!(ageMs < ADMIN_SESSION_MAX_HOURS * 60 * 60 * 1000)) return null;
  return { id: user.id, name: user.name, email: user.email };
}
