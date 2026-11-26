// Creates an admin account, or resets one that lost its password or phone.
//
//   pnpm admin:create --email you@example.com --name "Your Name"
//   pnpm admin:create --email you@example.com --name "Your Name" --reset
//
// Prints a new random password, a QR code for your authenticator app (Google Authenticator,
// 1Password, Authy…) and 10 backup codes. They are shown once: save them in a password manager.
// --json prints the same as JSON (used by the browser tests).
import "dotenv/config";

import { parseArgs } from "node:util";

import { renderUnicodeCompact } from "uqr";
import { ZodError } from "zod";

import { AdminAccountError, createAdmin } from "@/lib/admin-accounts";
import { getDb } from "@/lib/db";
import { siteUrl } from "@/lib/site-url";

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
      reset: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
    },
  });

  try {
    const admin = await createAdmin({
      email: values.email ?? "",
      name: values.name ?? "",
      reset: values.reset,
    });
    if (values.json) {
      console.log(JSON.stringify(admin));
      return 0;
    }
    console.log(`
Admin ready: ${admin.email}

Password (shown once): ${admin.password}

Scan this with your authenticator app:
${renderUnicodeCompact(admin.otpauthUri)}
Or type this key into the app: ${admin.totpSecret}

Backup codes (each works once, if you lose your phone):
  ${admin.backupCodes.join("\n  ")}

Sign in at ${siteUrl}/admin/login
`);
    return 0;
  } catch (error) {
    if (error instanceof ZodError) {
      console.error(error.issues.map((issue) => issue.message).join("\n"));
      console.error(
        'Usage: pnpm admin:create --email you@example.com --name "Your Name" [--reset]',
      );
      return 1;
    }
    if (error instanceof AdminAccountError) {
      console.error(error.message);
      return 1;
    }
    throw error;
  } finally {
    await getDb().$disconnect();
  }
}

main().then((code) => process.exit(code));
