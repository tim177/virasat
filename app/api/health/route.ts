import { connection } from "next/server";

import { checkDatabase } from "@/lib/db-health";

// Used by uptime monitors and the deploy script. Never cached, never prerendered.
export async function GET() {
  await connection();
  const db = await checkDatabase();

  if (!db.ok) {
    // Don't leak connection details to the public; the server log has the full error.
    console.error("Health check: database unreachable:", db.error);
    return Response.json({ status: "error", database: "down" }, { status: 503 });
  }

  return Response.json({ status: "ok", database: "up", latencyMs: db.latencyMs });
}
