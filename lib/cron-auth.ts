import { timingSafeEqual } from "node:crypto";

/**
 * True when a request to /api/cron/* carries "Authorization: Bearer $CRON_SECRET".
 * Always false while CRON_SECRET is unset, so the routes stay closed by default.
 */
export function isCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
