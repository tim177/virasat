import { createHmac } from "node:crypto";

// Time-based one-time codes (RFC 6238), the 6-digit codes an authenticator app shows.
// Better Auth checks the codes at sign-in; this file makes them, for `pnpm admin:create`
// (to confirm a new authenticator secret works) and for tests.

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/\s+/g, "").replace(/=+$/, "").toUpperCase();
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index === -1) throw new Error("The secret is not valid base32");
    value = ((value << 5) | index) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

/** The code an authenticator app shows for a base32 secret (SHA-1, 30-second steps). */
export function totpCode(
  base32Secret: string,
  timeMs = Date.now(),
  digits = 6,
  periodSeconds = 30,
) {
  return totpCodeFromKey(base32Decode(base32Secret), timeMs, digits, periodSeconds);
}

/** The same code from the raw key bytes (what base32 in the QR code encodes). */
export function totpCodeFromKey(key: Buffer, timeMs = Date.now(), digits = 6, periodSeconds = 30) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(timeMs / 1000 / periodSeconds)));
  const hmac = createHmac("sha1", key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const number = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(number % 10 ** digits).padStart(digits, "0");
}

/** The base32 secret inside an otpauth://totp/... link (what the QR code contains). */
export function secretFromOtpauthUri(uri: string): string {
  const secret = new URL(uri).searchParams.get("secret");
  if (!secret) throw new Error("The otpauth link has no secret");
  return secret;
}
