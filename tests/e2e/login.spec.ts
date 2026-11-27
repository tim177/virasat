import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { closeDb, deleteUsersMatching, userByEmail } from "./helpers/db";
import { deleteOutboxEmails, loginCodeFor } from "./helpers/outbox";

// Customer sign-in with an emailed 6-digit code (v1 spec, Step 7). The production build used by
// these tests ignores DEV_VERIFICATION_CODE, so they read the real code from .outbox/.

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const runId = randomUUID().slice(0, 8);

function alert(page: Page, text: string) {
  return page.getByRole("alert").filter({ hasText: text });
}

test.afterAll(async () => {
  await deleteUsersMatching(runId);
  await deleteOutboxEmails(runId);
  await closeDb();
});

test("a shopper signs in with an email code, then signs out", async ({ page }, testInfo) => {
  const email = `e2e-login-${testInfo.project.name}-${runId}@example.com`;
  test.info().annotations.push({ type: "email", description: email });
  try {
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login\?next=%2Faccount$/);
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
    // Google stays hidden until its keys are set.
    await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
    const axe = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);

    // Keyboard only: type the address and press Enter.
    const sentAfter = Date.now();
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Email address").press("Enter");
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await expect(page.getByText(`We sent a 6-digit code to ${email}`)).toBeVisible();

    const code = await loginCodeFor(email, sentAfter);
    const wrong = code === "000000" ? "111111" : "000000";
    const codeField = page.getByLabel("6-digit code");
    await expect(codeField).toBeFocused();
    await codeField.fill(wrong);
    await codeField.press("Enter");
    await expect(alert(page, "That code isn't right")).toBeVisible();

    await codeField.fill(code);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/account$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Your account" })).toBeVisible();
    await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();

    const user = await userByEmail(email);
    expect(user).toMatchObject({ role: "customer", email_verified: true });

    // Signed in, /login goes straight to the account.
    await page.goto("/login");
    await expect(page).toHaveURL(/\/account$/);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login\?next=%2Faccount$/);
  } finally {
    await deleteOutboxEmails(email);
  }
});

test("the sign-in page checks the address before sending a code", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("not-an-email");
  await page.getByRole("button", { name: "Email me a code" }).click();
  await expect(alert(page, "Enter your email address")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Check your email" })).toHaveCount(0);
});
