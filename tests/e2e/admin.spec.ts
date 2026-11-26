import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { totpCode } from "../../lib/totp";

import { createTestAdmin, type TestAdmin } from "./helpers/admin";
import { closeDb, deleteOrdersMatching, deleteUsersMatching, insertTestOrder } from "./helpers/db";

// The admin: sign-in with a password and an authenticator code (CLAUDE.md rule 7), and
// processing an order from paid to delivered (v1 spec, Step 6).

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

// Checking a password is deliberately slow (scrypt), and slower still while the whole suite
// runs in parallel, so the steps right after a sign-in request get more time.
const signInExpect = expect.configure({ timeout: 15_000 });

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
    await deleteOrdersMatching(runId);
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
    await signInExpect(code).toBeFocused();
    await code.fill(totpCode(admin.totpSecret));
    await page.getByRole("button", { name: "Verify" }).click();

    await signInExpect(page).toHaveURL(/\/admin$/);
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
    await signInExpect(alert(page, "The email or password is incorrect.")).toBeVisible();

    await enterPassword(page, admin.password);
    const right = totpCode(admin.totpSecret);
    const wrong = String((Number(right) + 1) % 1_000_000).padStart(6, "0");
    await page.getByLabel("Authentication code").fill(wrong);
    await page.getByRole("button", { name: "Verify" }).click();
    await signInExpect(
      alert(page, "That code didn't work. Check the app and try again."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Use a backup code instead" }).click();
    await page.getByLabel("Backup code").fill(admin.backupCodes[0]);
    await page.getByRole("button", { name: "Verify" }).click();
    await signInExpect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1, name: "Welcome, E2E Admin" })).toBeVisible();
  });

  test("processes an order from paid to delivered", async ({ page }) => {
    const email = `e2e-order-${runId}@example.com`;
    const number = await insertTestOrder(email);

    await enterPassword(page, admin.password);
    await page.getByLabel("Authentication code").fill(totpCode(admin.totpSecret));
    await page.getByRole("button", { name: "Verify" }).click();
    await signInExpect(page).toHaveURL(/\/admin$/);

    await page
      .getByRole("navigation", { name: "Admin" })
      .getByRole("link", { name: "Orders" })
      .click();
    await page.getByLabel("Search by order number or email").fill(email);
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByRole("link", { name: number })).toBeVisible();
    await expectNoWcagViolations(page);
    await page.getByRole("link", { name: number }).click();
    await expect(page.getByRole("heading", { level: 1, name: number })).toBeVisible();

    const moved = (status: string) =>
      expect(
        page.getByRole("status").filter({ hasText: `Order moved to ${status}.` }),
      ).toBeVisible();
    await page.getByRole("button", { name: "Confirm order" }).click();
    await moved("Confirmed");
    await page.getByRole("button", { name: "Start production" }).click();
    await moved("In production");

    await page.getByRole("button", { name: "Mark as shipped" }).click();
    const dialog = page.getByRole("dialog", { name: "Mark as shipped" });
    await dialog.getByLabel("Courier").selectOption("dhl");
    await dialog.getByLabel("Tracking number").fill("JD014600006281");
    await dialog.getByRole("button", { name: "Mark as shipped" }).click();
    await expect(dialog).toBeHidden();
    await moved("Shipped");
    await expect(page.getByTestId("tracking-number")).toHaveText("JD014600006281");
    // The shipped email is sent right after the change (to .outbox/ without a Resend key).
    await expect.poll(() => outboxCount("order-shipped", email)).toBe(1);

    await page.getByRole("button", { name: "Mark as delivered" }).click();
    await moved("Delivered");
    await expect(page.getByText("This order is finished.")).toBeVisible();
    await expect.poll(() => outboxCount("order-delivered", email)).toBe(1);

    await page.getByLabel("Internal note").fill("Left with the neighbour, customer confirmed");
    await page.getByRole("button", { name: "Save note" }).click();
    const history = page.getByTestId("order-history");
    await expect(history).toContainText("Left with the neighbour, customer confirmed");
    await expect(history).toContainText("Shipped → Delivered");
    await expect(history).toContainText("DHL Express JD014600006281");
    await expectNoWcagViolations(page);
  });
});

async function outboxCount(tag: string, email: string): Promise<number> {
  const safe = email.replace(/[^a-z0-9]+/gi, "_").slice(0, 40);
  const files = await readdir(".outbox").catch(() => [] as string[]);
  return files.filter((f) => f.includes(tag) && f.includes(safe)).length;
}
