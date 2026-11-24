import "server-only";

import { getDb } from "@/lib/db";

export type DatabaseHealth = { ok: true; latencyMs: number } | { ok: false; error: string };

/** Runs a trivial query to prove the app can reach Postgres. */
export async function checkDatabase(): Promise<DatabaseHealth> {
  const started = performance.now();
  try {
    await getDb().$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Math.round(performance.now() - started) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown database error" };
  }
}
