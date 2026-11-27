import { readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { expect } from "@playwright/test";

// Emails the app wrote to .outbox/ (no RESEND_API_KEY in tests): lib/email/send.ts names each
// file "<time>-<tag>-<address with symbols as _>.html".

const OUTBOX = path.resolve(".outbox");

function fileTag(tag: string, email: string): string {
  return `-${tag}-${email.replace(/[^a-z0-9]+/gi, "_").slice(0, 40)}.html`;
}

async function outboxFiles(tag: string, email: string): Promise<string[]> {
  const names = await readdir(OUTBOX).catch(() => [] as string[]);
  return names.filter((name) => name.endsWith(fileTag(tag, email))).sort();
}

/** The newest sign-in code emailed to this address (waits for the email to arrive). */
export async function loginCodeFor(email: string, after = 0): Promise<string> {
  let code = "";
  await expect
    .poll(
      async () => {
        const files = await outboxFiles("login-code", email);
        const newest = files.filter((name) => Number(name.split("-")[0]) >= after).at(-1);
        if (!newest) return "";
        const html = await readFile(path.join(OUTBOX, newest), "utf8");
        code = /data-login-code="(\d{6})"/.exec(html)?.[1] ?? "";
        return code;
      },
      { timeout: 15_000 },
    )
    .toMatch(/^\d{6}$/);
  return code;
}

/** Deletes the emails a test run sent: every address containing `fragment` (e.g. its run id). */
export async function deleteOutboxEmails(fragment: string): Promise<void> {
  const names = await readdir(OUTBOX).catch(() => [] as string[]);
  const part = fragment.replace(/[^a-z0-9]+/gi, "_");
  for (const name of names.filter((n) => n.includes(part))) {
    await rm(path.join(OUTBOX, name), { force: true });
  }
}
