import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { adminFromSession, type Admin } from "@/lib/admin-access";
import { getAuth } from "@/lib/auth";

/**
 * The signed-in admin, or null. Reads the session from the database on every call (no
 * cookie cache), so a signed-out or removed admin loses access at once.
 */
export async function getAdmin(): Promise<Admin | null> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  return adminFromSession(session, new Date());
}

/**
 * Call first in every admin page, Server Action and admin API route (CLAUDE.md rule 7).
 * proxy.ts only redirects visitors with no session cookie; this is the real check.
 */
export async function requireAdmin(): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
