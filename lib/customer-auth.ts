import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth } from "@/lib/auth";

// The signed-in shopper for account pages. Read on the server on every request (no cookie
// cache), inside a <Suspense> boundary. Admins are users too, but their admin rights are only
// checked by requireAdmin() (lib/admin-auth.ts).

export type Customer = {
  id: string;
  email: string;
  name: string;
  /** True for email-code and Google sign-ins: they prove the person owns the address. */
  emailVerified: boolean;
  createdAt: Date;
};

export async function getCustomer(): Promise<Customer | null> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;
  const { user } = session;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    createdAt: new Date(user.createdAt),
  };
}

/** The signed-in shopper, or a redirect to /login that comes back to `returnTo` afterwards. */
export async function requireCustomer(returnTo: string): Promise<Customer> {
  const customer = await getCustomer();
  if (!customer) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return customer;
}

/** "Just created" means the account was made by this sign-in (for the sign_up analytics event). */
export function isNewAccount(customer: Customer, now = new Date()): boolean {
  return now.getTime() - customer.createdAt.getTime() < 5 * 60_000;
}
