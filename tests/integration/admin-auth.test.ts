import { randomUUID } from "node:crypto";

import { afterAll, afterEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { adminFromSession } from "@/lib/admin-access";
import { AdminAccountError, createAdmin } from "@/lib/admin-accounts";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { totpCode } from "@/lib/totp";

// Admin login against the real database: accounts made by `pnpm admin:create`, password plus
// authenticator code, and who counts as an admin. Every user made here is deleted afterwards.

const db = getDb();
const auth = getAuth();
const DOMAIN = "@it-admin.example.com";
const suiteStart = new Date();
const newEmail = (label: string) => `${label}-${randomUUID().slice(0, 8)}${DOMAIN}`;

afterEach(async () => {
  await db.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
  // Pending two-factor sign-ins (they expire on their own after 10 minutes).
  await db.verification.deleteMany({
    where: { identifier: { startsWith: "2fa-" }, createdAt: { gte: suiteStart } },
  });
});

afterAll(async () => {
  await db.$disconnect();
});

/** "a=1; b=2" from a response's Set-Cookie headers. */
function cookiesFrom(headers: Headers): Headers {
  const cookie = headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .filter((c) => !c.endsWith("=")) // skip cookies being deleted
    .join("; ");
  return new Headers({ cookie });
}

async function signInWithPassword(email: string, password: string) {
  const { headers, response } = await auth.api.signInEmail({
    body: { email, password },
    returnHeaders: true,
  });
  return { cookies: cookiesFrom(headers), response };
}

/** Password, then authenticator code: returns the session cookies. */
async function signInAsAdmin(email: string, password: string, code: string) {
  const { cookies } = await signInWithPassword(email, password);
  const { headers } = await auth.api.verifyTOTP({
    body: { code },
    headers: cookies,
    returnHeaders: true,
  });
  return cookiesFrom(headers);
}

describe("pnpm admin:create", () => {
  it("makes an admin with two-factor on and leaves no session behind", async () => {
    const creds = await createAdmin({ email: newEmail("New.Admin"), name: "  IT Admin " });

    expect(creds.email).toBe(creds.email.toLowerCase());
    expect(creds.password.length).toBeGreaterThanOrEqual(20);
    expect(creds.backupCodes).toHaveLength(10);
    const user = await db.user.findUniqueOrThrow({
      where: { email: creds.email },
      include: { sessions: true, twoFactors: true },
    });
    expect(user).toMatchObject({
      name: "IT Admin",
      role: "admin",
      emailVerified: true,
      twoFactorEnabled: true,
    });
    expect(user.sessions).toHaveLength(0);
    // The authenticator secret is stored encrypted, never as the base32 key itself.
    expect(user.twoFactors[0].secret).not.toContain(creds.totpSecret);
  });

  it("refuses an existing email unless asked to reset, and never promotes a customer", async () => {
    const creds = await createAdmin({ email: newEmail("twice"), name: "IT Admin" });
    await expect(createAdmin({ email: creds.email, name: "IT Admin" })).rejects.toThrow(
      AdminAccountError,
    );

    const customerEmail = newEmail("customer");
    await db.user.create({ data: { email: customerEmail, name: "Shopper" } });
    await expect(
      createAdmin({ email: customerEmail, name: "Shopper", reset: true }),
    ).rejects.toThrow(AdminAccountError);
    const customer = await db.user.findUniqueOrThrow({ where: { email: customerEmail } });
    expect(customer.role).toBe("customer");
  });

  it("rejects bad input", async () => {
    await expect(createAdmin({ email: "not-an-email", name: "X" })).rejects.toThrow(ZodError);
    await expect(createAdmin({ email: newEmail("noname"), name: "   " })).rejects.toThrow(ZodError);
  });

  it("reset replaces the password and authenticator and signs the admin out", async () => {
    const old = await createAdmin({ email: newEmail("reset"), name: "IT Admin" });
    await signInAsAdmin(old.email, old.password, totpCode(old.totpSecret));
    const user = await db.user.findUniqueOrThrow({ where: { email: old.email } });
    expect(await db.session.count({ where: { userId: user.id } })).toBe(1);

    const fresh = await createAdmin({ email: old.email, name: "IT Admin", reset: true });
    expect(fresh.password).not.toBe(old.password);
    expect(fresh.totpSecret).not.toBe(old.totpSecret);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);

    await expect(signInWithPassword(old.email, old.password)).rejects.toThrow();
    const cookies = await signInAsAdmin(fresh.email, fresh.password, totpCode(fresh.totpSecret));
    const session = await auth.api.getSession({ headers: cookies });
    expect(adminFromSession(session, new Date())?.email).toBe(fresh.email);
  });
});

describe("admin sign-in", () => {
  it("needs the authenticator code after the password", async () => {
    const creds = await createAdmin({ email: newEmail("signin"), name: "IT Admin" });
    const { cookies, response } = await signInWithPassword(creds.email, creds.password);

    expect(response).toMatchObject({ twoFactorRedirect: true, twoFactorMethods: ["totp"] });
    // The password alone gives no session.
    expect(await auth.api.getSession({ headers: cookies })).toBeNull();

    const sessionCookies = await signInAsAdmin(
      creds.email,
      creds.password,
      totpCode(creds.totpSecret),
    );
    const session = await auth.api.getSession({ headers: sessionCookies });
    expect(adminFromSession(session, new Date())).toEqual({
      id: session!.user.id,
      name: "IT Admin",
      email: creds.email,
    });
  });

  it("refuses a wrong code and a wrong password", async () => {
    const creds = await createAdmin({ email: newEmail("wrong"), name: "IT Admin" });
    await expect(signInWithPassword(creds.email, `${creds.password}x`)).rejects.toThrow();

    const { cookies } = await signInWithPassword(creds.email, creds.password);
    const right = totpCode(creds.totpSecret);
    const wrong = String((Number(right) + 1) % 1_000_000).padStart(6, "0");
    await expect(
      auth.api.verifyTOTP({ body: { code: wrong }, headers: cookies }),
    ).rejects.toThrow();
    // No code at all, without the pending sign-in cookie.
    await expect(
      auth.api.verifyTOTP({ body: { code: right }, headers: new Headers() }),
    ).rejects.toThrow();
  });

  it("accepts each backup code once", async () => {
    const creds = await createAdmin({ email: newEmail("backup"), name: "IT Admin" });
    const [code] = creds.backupCodes;

    const first = await signInWithPassword(creds.email, creds.password);
    const { headers } = await auth.api.verifyBackupCode({
      body: { code },
      headers: first.cookies,
      returnHeaders: true,
    });
    const session = await auth.api.getSession({ headers: cookiesFrom(headers) });
    expect(adminFromSession(session, new Date())).not.toBeNull();

    const second = await signInWithPassword(creds.email, creds.password);
    await expect(
      auth.api.verifyBackupCode({ body: { code }, headers: second.cookies }),
    ).rejects.toThrow();
  });

  it("a signed-in customer is not an admin", async () => {
    const ctx = await auth.$context;
    const email = newEmail("shopper");
    const password = "a-long-customer-password";
    const user = await db.user.create({ data: { email, name: "Shopper" } });
    await db.account.create({
      data: {
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password: await ctx.password.hash(password),
      },
    });

    const { cookies, response } = await signInWithPassword(email, password);
    expect(response).not.toHaveProperty("twoFactorRedirect");
    const session = await auth.api.getSession({ headers: cookies });
    expect(session?.user.email).toBe(email);
    expect(adminFromSession(session, new Date())).toBeNull();
  });

  it("nobody can sign up", async () => {
    await expect(
      auth.api.signUpEmail({
        body: { email: newEmail("signup"), password: "a-long-enough-password", name: "Eve" },
      }),
    ).rejects.toThrow();
  });
});
