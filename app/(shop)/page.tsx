import { connection } from "next/server";
import { Suspense } from "react";

import { ZariRule } from "@/components/ui/ornament";
import { checkDatabase } from "@/lib/db-health";

// Temporary home page from Step 1. Replaced by the real home page in Step 4.
export default function Home() {
  return (
    <div className="page-container flex flex-1 flex-col justify-center gap-6 py-16">
      <h1 className="font-display text-h1 md:text-display-2">Virasat</h1>
      <ZariRule className="max-w-xs" />
      <p className="max-w-xl text-body-lg text-stone-700">
        Project setup is running. The shop arrives in the next steps.
      </p>
      <Suspense fallback={<p role="status">Checking database…</p>}>
        <DatabaseStatus />
      </Suspense>
    </div>
  );
}

async function DatabaseStatus() {
  await connection();
  const db = await checkDatabase();

  return (
    <p role="status" data-testid="db-status">
      {db.ok ? `Database: connected (${db.latencyMs} ms)` : "Database: not connected"}
    </p>
  );
}
