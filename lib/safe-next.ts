// Where to send someone after they sign in (?next=...). Only paths on this site, never another
// domain, the login pages themselves, the admin or the API: an open redirect would let a
// phishing link bounce through our login page.

const BLOCKED_PREFIXES = ["/login", "/admin", "/api"];
const ORIGIN = "http://virasat.invalid";

export function safeNextPath(raw: unknown, fallback = "/account"): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 500) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  let url: URL;
  try {
    url = new URL(raw, ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== ORIGIN) return fallback;
  const path = url.pathname;
  if (BLOCKED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return fallback;
  }
  return `${path}${url.search}${url.hash}`;
}
