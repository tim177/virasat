// Is a database address on this computer? Development-only shortcuts (the dev admin, the dev
// verification code) refuse to run against any other database.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function databaseHost(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function isLocalDatabaseUrl(url: string | undefined): boolean {
  const host = databaseHost(url);
  return host !== null && LOCAL_HOSTS.has(host);
}
