import "server-only";

// Simple in-memory rate limit per client IP. Enough for one server (the prototype runs on one
// VM); Cloudflare's rate limiting sits in front for anything heavier.

type Window = { count: number; resetAt: number };
const windows = new Map<string, Window>();

export function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "local"
  );
}

/** Returns true if the request is allowed. `limit` requests per `windowMs` per key. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    if (windows.size > 10_000) {
      for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
    }
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

export function tooManyRequests(): Response {
  return Response.json(
    { error: "too_many_requests" },
    { status: 429, headers: { "Retry-After": "60" } },
  );
}
