import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { totpCode } from "../../lib/totp";

import { createTestAdmin, type TestAdmin } from "./helpers/admin";
import { closeDb, deleteUsersMatching } from "./helpers/db";

// Admin sign-in: password, then a code from an authenticator app (CLAUDE.md rule 7).

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** Our error message (Next.js keeps its own empty role="alert" route announcer on the page). */
function alert(page: Page, text: string) {
  return page.getByRole("alert").filter({ hasText: text });
}

async function expectNoWcagViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
}

test("signed-out visitors are sent to the admin sign-in", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole("heading", { level: 1, name: "Admin sign-in" })).toBeVisible();
  await expectNoWcagViolations(page);
});

test.describe("an admin", () => {
  // Desktop only: each sign-in counts against the shared per-IP rate limits.
  test.skip(({ isMobile }) => isMobile, "Admin sign-in runs on the desktop project");
  test.describe.configure({ mode: "serial" });

  const runId = randomUUID().slice(0, 8);
  let admin: TestAdmin;

  test.beforeAll(() => {
    admin = createTestAdmin(`e2e-admin-${runId}@example.com`, "E2E Admin");
  });

  test.afterAll(async () => {
    await deleteUsersMatching(runId);
    await closeDb();
  });

  async function enterPassword(page: Page, password: string) {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(admin.email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Continue" }).click();
  }

  test("signs in with password and authenticator code, then signs out", async ({ page }) => {
    await enterPassword(page, admin.password);
    const code = page.getByLabel("Authentication code");
    await expect(code).toBeFocused();
    await code.fill(totpCode(admin.totpSecret));
    await page.getByRole("button", { name: "Verify" }).click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1, name: "Welcome, E2E Admin" })).toBeVisible();
    await expect(page.getByText("Signed in as E2E Admin")).toBeVisible();
    await expectNoWcagViolations(page);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("a wrong password or code is refused; a backup code works", async ({ page }) => {
    await enterPassword(page, `${admin.password}x`);
    await expect(alert(page, "The email or password is incorrect.")).toBeVisible();

    await enterPassword(page, admin.password);
    const right = totpCode(admin.totpSecret);
    const wrong = String((Number(right) + 1) % 1_000_000).padStart(6, "0");
    await page.getByLabel("Authentication code").fill(wrong);
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(alert(page, "That code didn't work. Check the app and try again.")).toBeVisible();

    await page.getByRole("button", { name: "Use a backup code instead" }).click();
    await page.getByLabel("Backup code").fill(admin.backupCodes[0]);
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1, name: "Welcome, E2E Admin" })).toBeVisible();
  });
});
