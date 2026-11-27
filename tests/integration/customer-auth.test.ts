import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { adminFromSession } from "@/lib/admin-access";
import { createAdmin } from "@/lib/admin-accounts";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { turnstileKeys } from "@/lib/login-config";
import { siteUrl } from "@/lib/site-url";
import { totpCode } from "@/lib/totp";

// Customer login against the real database: email codes (real and the local dev code), and the
// rules that keep admin accounts on password + authenticator. Every user made here is deleted.

const sendEmail = vi.hoisted(() =>
  vi.fn<(message: { to: string; subject: string }) => Promise<{ id: string }>>(async () => ({
    id: "test",
  })),
);
vi.mock("@/lib/email/send", () => ({ sendEmail }));

const db = getDb();
const auth = getAuth();
const DOMAIN = "@it-customer.example.com";
const suiteStart = new Date();
const newEmail = (label: string) => `${label}-${randomUUID().slice(0, 8)}${DOMAIN}`;

beforeEach(() => {
  sendEmail.mockClear();
  vi.stubEnv("DEV_VERIFICATION_CODE", "");
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await db.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
  await db.verification.deleteMany({
    where: {
      OR: [
        { identifier: { endsWith: DOMAIN } },
        { identifier: { startsWith: "2fa-" }, createdAt: { gte: suiteStart } },
      ],
    },
  });
});

afterAll(async () => {
  await db.$disconnect();
});

function cookiesFrom(headers: Headers): Headers {
  const cookie = headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .filter((c) => !c.endsWith("="))
    .join("; ");
  return new Headers({ cookie });
}

async function requestCode(email: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } });
}

/** The code from the sign-in email (sent in the background). */
async function emailedCode(email: string): Promise<string> {
  const message = await vi.waitFor(() => {
    const call = sendEmail.mock.calls.find(([m]) => m.to === email);
    if (!call) throw new Error("no email yet");
    return call[0];
  });
  const code = /^(\d{6}) is your Virasat sign-in code$/.exec(message.subject)?.[1];
  if (!code) throw new Error(`unexpected subject: ${message.subject}`);
  return code;
}

async function signInWithCode(email: string, otp: string) {
  const { headers, response } = await auth.api.signInEmailOTP({
    body: { email, otp },
    returnHeaders: true,
  });
  return { cookies: cookiesFrom(headers), user: response.user };
}

describe("customer sign-in by email code", () => {
  it("makes a verified customer account on first sign-in, and finds it again later", async () => {
    const email = newEmail("new");
    await requestCode(email);
    const first = await signInWithCode(email, await emailedCode(email));

    const user = await db.user.findUniqueOrThrow({ where: { email } });
    expect(user.role).toBe("customer");
    expect(user.emailVerified).toBe(true);
    expect(user.twoFactorEnabled).toBe(false);
    expect(first.user.id).toBe(user.id);
    const session = await auth.api.getSession({ headers: first.cookies });
    expect(session?.user.email).toBe(email);
    expect(adminFromSession(session, new Date())).toBeNull();

    sendEmail.mockClear();
    await requestCode(email.toUpperCase());
    const again = await signInWithCode(email, await emailedCode(email));
    expect(again.user.id).toBe(user.id);
  });

  it("rejects a wrong code, and a code can be used only once", async () => {
    const email = newEmail("wrong");
    await requestCode(email);
    const code = await emailedCode(email);
    const wrong = code === "123456" ? "654321" : "123456";
    await expect(signInWithCode(email, wrong)).rejects.toMatchObject({
      body: { code: "INVALID_OTP" },
    });
    await signInWithCode(email, code);
    await expect(signInWithCode(email, code)).rejects.toMatchObject({
      body: { code: "INVALID_OTP" },
    });
  });

  it("never lets a sign-up choose its own role", async () => {
    const email = newEmail("role");
    await requestCode(email);
    const code = await emailedCode(email);
    await auth.api
      .signInEmailOTP({ body: { email, otp: code, role: "admin" } })
      .catch(() => undefined);
    const user = await db.user.findUnique({ where: { email } });
    expect(user?.role ?? "customer").toBe("customer");
  });

  it("only sends sign-in codes (no password resets by email)", async () => {
    await expect(
      auth.api.sendVerificationOTP({ body: { email: newEmail("reset"), type: "forget-password" } }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("the local dev code", () => {
  it("is the sign-in code in local development", async () => {
    vi.stubEnv("DEV_VERIFICATION_CODE", "000000");
    const email = newEmail("dev");
    await requestCode(email);
    expect(await emailedCode(email)).toBe("000000");
    const { user } = await signInWithCode(email, "000000");
    expect(user.email).toBe(email);
  });

  it("does nothing in production", async () => {
    vi.stubEnv("DEV_VERIFICATION_CODE", "000000");
    vi.stubEnv("NODE_ENV", "production");
    const email = newEmail("prod");
    await requestCode(email);
    const code = await emailedCode(email);
    if (code !== "000000") {
      await expect(signInWithCode(email, "000000")).rejects.toMatchObject({
        body: { code: "INVALID_OTP" },
      });
    }
    // The real code still works.
    await signInWithCode(email, code);
  });
});

describe.skipIf(!turnstileKeys())("Turnstile (when its keys are set)", () => {
  // Real requests through the HTTP handler: Turnstile only checks requests from browsers.
  async function post(path: string, body: unknown) {
    return auth.handler(
      new Request(`${siteUrl}/api/auth${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: siteUrl },
        body: JSON.stringify(body),
      }),
    );
  }

  it("refuses login steps without a token", async () => {
    const code = await post("/email-otp/send-verification-otp", {
      email: newEmail("bot"),
      type: "sign-in",
    });
    expect(code.status).toBe(400);
    expect(await code.json()).toMatchObject({ code: "MISSING_RESPONSE" });
    expect(sendEmail).not.toHaveBeenCalled();

    const password = await post("/sign-in/email", {
      email: newEmail("bot"),
      password: "a-long-enough-password",
    });
    expect(password.status).toBe(400);
  });
});

describe("admin accounts", () => {
  async function newAdmin() {
    return createAdmin({ email: newEmail("admin"), name: "Test Admin" });
  }

  it("get no email codes and can't sign in with one", async () => {
    const admin = await newAdmin();
    await requestCode(admin.email);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(sendEmail).not.toHaveBeenCalled();

    // Even with the code (here the dev code), the session is refused.
    vi.stubEnv("DEV_VERIFICATION_CODE", "000000");
    await requestCode(admin.email);
    await expect(signInWithCode(admin.email, "000000")).rejects.toMatchObject({
      body: { code: "ADMIN_SIGN_IN_REQUIRED" },
    });
    const user = await db.user.findUniqueOrThrow({ where: { email: admin.email } });
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("can't get a session or a Google login outside the admin sign-in", async () => {
    const admin = await newAdmin();
    const user = await db.user.findUniqueOrThrow({ where: { email: admin.email } });
    const ctx = await auth.$context;
    await expect(ctx.internalAdapter.createSession(user.id)).rejects.toMatchObject({
      body: { code: "ADMIN_SIGN_IN_REQUIRED" },
    });
    const linked = await ctx.internalAdapter.createAccount({
      userId: user.id,
      providerId: "google",
      accountId: `google-${randomUUID()}`,
    });
    expect(linked).toBeNull();
    expect(await db.account.count({ where: { userId: user.id, providerId: "google" } })).toBe(0);
  });

  it("accept the dev code as the authenticator code in development only", async () => {
    const admin = await newAdmin();
    const passwordStep = async () => {
      const { headers } = await auth.api.signInEmail({
        body: { email: admin.email, password: admin.password },
        returnHeaders: true,
      });
      return cookiesFrom(headers);
    };

    vi.stubEnv("DEV_VERIFICATION_CODE", "000000");
    const { headers } = await auth.api.verifyTOTP({
      body: { code: "000000" },
      headers: await passwordStep(),
      returnHeaders: true,
    });
    const session = await auth.api.getSession({ headers: cookiesFrom(headers) });
    expect(adminFromSession(session, new Date())?.email).toBe(admin.email);

    // The real code keeps working with the dev code on.
    await auth.api.verifyTOTP({
      body: { code: totpCode(admin.totpSecret) },
      headers: await passwordStep(),
    });

    vi.stubEnv("NODE_ENV", "production");
    const realCode = totpCode(admin.totpSecret);
    if (realCode !== "000000") {
      await expect(
        auth.api.verifyTOTP({ body: { code: "000000" }, headers: await passwordStep() }),
      ).rejects.toMatchObject({ statusCode: 401 });
    }
  });
});
