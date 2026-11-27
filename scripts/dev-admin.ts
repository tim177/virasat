// The local development admin, from .env. Run: pnpm admin:dev
//
// Creates (or resets) the admin in ADMIN_EMAIL with the password in ADMIN_PASSWORD (made up and
// saved to .env if empty), turns on two-step sign-in, and saves the authenticator secret to .env
// as ADMIN_TOTP_SECRET. `pnpm admin:code` then prints the current 6-digit code, so signing in
// locally needs no phone. Local databases only: on a server, use `pnpm admin:create`.
import "dotenv/config";

import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { ZodError } from "zod";

import { AdminAccountError, createAdmin } from "@/lib/admin-accounts";
import { getDb } from "@/lib/db";
import { devVerificationCode } from "@/lib/dev-code";
import { databaseHost, isLocalDatabaseUrl } from "@/lib/local-database";
import { siteUrl } from "@/lib/site-url";

const ENV_FILE = ".env";

function assertLocalDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
  if (!isLocalDatabaseUrl(url)) {
    throw new Error(
      `Refusing to make the dev admin on a non-local database (${databaseHost(url)}). Use pnpm admin:create.`,
    );
  }
}

/** Sets KEY="value" lines in .env, replacing existing ones and appending new ones. */
async function saveToEnv(values: Record<string, string>) {
  let text = await readFile(ENV_FILE, "utf8").catch(() => "");
  const added: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}="${value}"`;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    if (pattern.test(text)) text = text.replace(pattern, line);
    else added.push(line);
  }
  if (added.length > 0) {
    const header = "\n# Local dev admin (pnpm admin:dev). Never put these on a server.\n";
    text = `${text.replace(/\s*$/, "\n")}${header}${added.join("\n")}\n`;
  }
  await writeFile(ENV_FILE, text, "utf8");
}

async function main(): Promise<number> {
  assertLocalDatabase();
  const email = (process.env.ADMIN_EMAIL || "admin@virasat.local").trim().toLowerCase();
  const name = process.env.ADMIN_NAME || "Virasat Admin";
  const password = process.env.ADMIN_PASSWORD || randomBytes(18).toString("base64url");

  try {
    const admin = await createAdmin({ email, name, password, reset: true });
    await saveToEnv({
      ADMIN_EMAIL: admin.email,
      ADMIN_NAME: name,
      ADMIN_PASSWORD: admin.password,
      ADMIN_TOTP_SECRET: admin.totpSecret,
    });
    console.log(`
Local admin ready: ${admin.email}
The password and authenticator secret are saved in .env (ADMIN_PASSWORD, ADMIN_TOTP_SECRET).

Sign in at ${siteUrl}/admin/login, then enter ${
      devVerificationCode() ?? "the code from: pnpm admin:code"
    } as the 6-digit code.
`);
    return 0;
  } catch (error) {
    if (error instanceof ZodError) {
      console.error(error.issues.map((issue) => issue.message).join("\n"));
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
