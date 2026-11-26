import { describe, expect, it } from "vitest";

import { ADMIN_SESSION_MAX_HOURS, adminFromSession } from "@/lib/admin-access";
import { base32Decode, secretFromOtpauthUri, totpCode } from "@/lib/totp";

describe("authenticator codes (RFC 6238)", () => {
  // The RFC's SHA-1 test secret, "12345678901234567890", in base32.
  const rfcSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

  it("decodes base32 secrets", () => {
    expect(base32Decode(rfcSecret).toString("ascii")).toBe("12345678901234567890");
    expect(base32Decode("gezd gnbv gy3t qojq gezd gnbv gy3t qojq").toString("ascii")).toBe(
      "12345678901234567890",
    );
    expect(() => base32Decode("not base32!")).toThrow();
  });

  it.each([
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ])("matches the RFC test vector at %i seconds", (seconds, expected) => {
    expect(totpCode(rfcSecret, seconds * 1000, 8)).toBe(expected);
    expect(totpCode(rfcSecret, seconds * 1000)).toBe(expected.slice(-6));
  });

  it("reads the secret from an otpauth link", () => {
    const uri = "otpauth://totp/Virasat:a%40b.com?secret=ABCDEF234567&issuer=Virasat&digits=6";
    expect(secretFromOtpauthUri(uri)).toBe("ABCDEF234567");
    expect(() => secretFromOtpauthUri("otpauth://totp/Virasat:a%40b.com")).toThrow();
  });
});

describe("who may open /admin", () => {
  const now = new Date("2026-11-26T12:00:00Z");
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);
  const session = (
    user: { role?: string | null; twoFactorEnabled?: boolean | null },
    createdAt = hoursAgo(1),
  ) => ({
    session: { createdAt },
    user: { id: "u1", name: "Asha", email: "asha@example.com", ...user },
  });

  it("lets in an admin with two-factor on and a fresh sign-in", () => {
    expect(adminFromSession(session({ role: "admin", twoFactorEnabled: true }), now)).toEqual({
      id: "u1",
      name: "Asha",
      email: "asha@example.com",
    });
  });

  it("keeps out visitors, customers and admins without two-factor", () => {
    expect(adminFromSession(null, now)).toBeNull();
    expect(adminFromSession(session({ role: "customer", twoFactorEnabled: true }), now)).toBeNull();
    expect(adminFromSession(session({ role: "admin", twoFactorEnabled: false }), now)).toBeNull();
    expect(adminFromSession(session({ role: "admin" }), now)).toBeNull();
    expect(adminFromSession(session({ role: null, twoFactorEnabled: true }), now)).toBeNull();
  });

  it(`asks admins to sign in again after ${ADMIN_SESSION_MAX_HOURS} hours`, () => {
    const admin = { role: "admin", twoFactorEnabled: true };
    expect(adminFromSession(session(admin, hoursAgo(11.9)), now)).not.toBeNull();
    expect(adminFromSession(session(admin, hoursAgo(12)), now)).toBeNull();
    expect(adminFromSession(session(admin, hoursAgo(48)), now)).toBeNull();
    // Dates from JSON arrive as strings.
    expect(
      adminFromSession(
        { ...session(admin), session: { createdAt: hoursAgo(1).toISOString() } },
        now,
      ),
    ).not.toBeNull();
    expect(
      adminFromSession({ ...session(admin), session: { createdAt: "not a date" } }, now),
    ).toBeNull();
  });
});
