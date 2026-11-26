import { execFileSync } from "node:child_process";

export type TestAdmin = {
  email: string;
  password: string;
  totpSecret: string;
  backupCodes: string[];
};

/**
 * Makes an admin the way you would (`pnpm admin:create --json`), in a separate process,
 * because Playwright can't load the Prisma 7 client. Delete it with deleteUsersMatching().
 */
export function createTestAdmin(email: string, name: string): TestAdmin {
  const output = execFileSync(
    process.execPath,
    [
      "--conditions=react-server",
      "--import",
      "tsx",
      "scripts/create-admin.ts",
      "--email",
      email,
      "--name",
      name,
      "--json",
    ],
    { encoding: "utf8" },
  );
  const json = output
    .trim()
    .split("\n")
    .findLast((line) => line.startsWith("{"));
  if (!json) throw new Error(`admin:create printed no JSON:\n${output}`);
  return JSON.parse(json) as TestAdmin;
}
