// Prints the current two-step sign-in code for the local dev admin: pnpm admin:code
// (Reads ADMIN_TOTP_SECRET from .env, written by pnpm admin:dev. Local development only.)
import "dotenv/config";

import { totpCode } from "../lib/totp";

const secret = process.env.ADMIN_TOTP_SECRET;
if (!secret) {
  console.error("ADMIN_TOTP_SECRET isn't in .env yet. Run: pnpm admin:dev");
  process.exit(1);
}

const now = Date.now();
const secondsLeft = 30 - (Math.floor(now / 1000) % 30);
console.log(`${totpCode(secret, now)}   (changes in ${secondsLeft}s)`);
