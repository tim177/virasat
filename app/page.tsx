import { connection } from "next/server";
import { Suspense } from "react";

import { checkDatabase } from "@/lib/db-health";

// Temporary page for Step 1 (project setup). Replaced by the real home page in Step 4.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-4xl font-semibold">Virasat</h1>
      <p className="text-lg">Project setup is running. The shop arrives in the next steps.</p>
      <Suspense fallback={<p role="status">Checking database…</p>}>
        <DatabaseStatus />
      </Suspense>
    </main>
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
