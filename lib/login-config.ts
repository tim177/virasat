import "server-only";

// Optional login services. Each turns itself on only when its keys are set in .env, so local
// development and CI work without accounts. Read at request time (not baked in at build), so a
// server only needs a restart after adding keys.

/** Cloudflare Turnstile on the login forms. Needs both keys; with only one it stays off. */
export function turnstileKeys(): { siteKey: string; secretKey: string } | null {
  const siteKey = process.env.TURNSTILE_SITE_KEY?.trim();
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim();
  return siteKey && secretKey ? { siteKey, secretKey } : null;
}

/** "Continue with Google". Needs the OAuth client ID and secret from Google Cloud. */
export function googleLoginKeys(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** What the login forms need to know. Only public values. */
export type LoginOptions = { turnstileSiteKey: string | null; google: boolean };

export function loginOptions(): LoginOptions {
  return {
    turnstileSiteKey: turnstileKeys()?.siteKey ?? null,
    google: googleLoginKeys() !== null,
  };
}
