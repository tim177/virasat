import { describe, expect, it } from "vitest";

import { adminMayGetSessionFrom } from "@/lib/admin-access";
import { isNewAccount, type Customer } from "@/lib/customer-auth";
import { devVerificationCode } from "@/lib/dev-code";
import { isLocalDatabaseUrl } from "@/lib/local-database";
import { safeNextPath } from "@/lib/safe-next";
import { base32Decode, totpCode, totpCodeFromKey } from "@/lib/totp";

const LOCAL_DB = "postgresql://virasat:pw@localhost:5432/virasat";

describe("dev verification code", () => {
  const env = (overrides: Record<string, string | undefined>) => ({
    DEV_VERIFICATION_CODE: "000000",
    NODE_ENV: "development",
    DATABASE_URL: LOCAL_DB,
    ...overrides,
  });

  it("works in local development", () => {
    expect(devVerificationCode(env({}))).toBe("000000");
    expect(devVerificationCode(env({ NODE_ENV: "test" }))).toBe("000000");
    expect(
      devVerificationCode(env({ DATABASE_URL: "postgresql://u:p@127.0.0.1:5432/virasat" })),
    ).toBe("000000");
    expect(devVerificationCode(env({ DEV_VERIFICATION_CODE: " 123456 " }))).toBe("123456");
  });

  it("can never work in production", () => {
    expect(devVerificationCode(env({ NODE_ENV: "production" }))).toBeNull();
  });

  it("is ignored with a database that isn't on this computer", () => {
    for (const url of [
      "postgresql://virasat:pw@postgres:5432/virasat", // the Docker Compose service
      "postgresql://virasat:pw@db.example.com:5432/virasat",
      "postgresql://virasat:pw@localhost.example.com:5432/virasat",
      "not a url",
      undefined,
    ]) {
      expect(devVerificationCode(env({ DATABASE_URL: url }))).toBeNull();
    }
  });

  it("is off unless set to exactly six digits", () => {
    for (const code of [undefined, "", "00000", "0000000", "abcdef", "00 000"]) {
      expect(devVerificationCode(env({ DEV_VERIFICATION_CODE: code }))).toBeNull();
    }
  });

  it("knows which databases are local", () => {
    expect(isLocalDatabaseUrl(LOCAL_DB)).toBe(true);
    expect(isLocalDatabaseUrl("postgresql://u:p@[::1]:5432/db")).toBe(true);
    expect(isLocalDatabaseUrl("postgresql://u:p@10.0.0.5:5432/db")).toBe(false);
  });
});

describe("where to go after signing in", () => {
  it.each([
    ["/account", "/account"],
    ["/p/ruby-silk-saree?size=m#details", "/p/ruby-silk-saree?size=m#details"],
    ["/bag", "/bag"],
  ])("allows the shop path %s", (raw, expected) => {
    expect(safeNextPath(raw)).toBe(expected);
  });

  it.each([
    "https://evil.example.com/",
    "//evil.example.com",
    "/\\evil.example.com",
    "javascript:alert(1)",
    "account",
    "/login",
    "/login/welcome?next=/account",
    "/admin",
    "/admin/orders",
    "/api/auth/sign-out",
    "",
    undefined,
    42,
    `/${"a".repeat(600)}`,
  ])("refuses %s", (raw) => {
    expect(safeNextPath(raw)).toBe("/account");
  });

  it("uses the fallback given", () => {
    expect(safeNextPath(undefined, "/")).toBe("/");
  });
});

describe("how admin accounts may sign in", () => {
  it("allows only the password and authenticator steps", () => {
    expect(adminMayGetSessionFrom("/sign-in/email")).toBe(true);
    expect(adminMayGetSessionFrom("/two-factor/verify-totp")).toBe(true);
    expect(adminMayGetSessionFrom("/two-factor/verify-backup-code")).toBe(true);
  });

  it("refuses customer sign-ins and anything else", () => {
    for (const path of [
      "/sign-in/email-otp",
      "/callback/:id",
      "/callback/google",
      "/sign-in/social",
      "/two-factor/enable",
      "",
      null,
      undefined,
    ]) {
      expect(adminMayGetSessionFrom(path)).toBe(false);
    }
  });
});

describe("authenticator codes from raw key bytes", () => {
  it("matches the base32 version", () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    const key = Buffer.from("12345678901234567890", "ascii");
    expect(totpCodeFromKey(key, 59_000, 8)).toBe("94287082");
    expect(totpCodeFromKey(base32Decode(secret), 1_234_567_890_000)).toBe(
      totpCode(secret, 1_234_567_890_000),
    );
  });
});

describe("new accounts (sign_up analytics)", () => {
  const now = new Date("2026-11-27T12:00:00Z");
  const customer = (minutesAgo: number): Customer => ({
    id: "u1",
    email: "asha@example.com",
    name: "",
    emailVerified: true,
    createdAt: new Date(now.getTime() - minutesAgo * 60_000),
  });

  it("counts accounts made in the last few minutes as new", () => {
    expect(isNewAccount(customer(0), now)).toBe(true);
    expect(isNewAccount(customer(4), now)).toBe(true);
    expect(isNewAccount(customer(6), now)).toBe(false);
    expect(isNewAccount(customer(60 * 24 * 30), now)).toBe(false);
  });
});
