import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

import { totpCode } from "../../lib/totp";

import { createTestAdmin, type TestAdmin } from "./helpers/admin";
import {
  closeDb,
  deleteOrdersMatching,
  deleteProductsMatching,
  deleteUnusedUploadsSince,
  deleteUsersMatching,
  insertTestOrder,
} from "./helpers/db";
import { deleteOutboxEmails } from "./helpers/outbox";

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
  const startedAt = new Date();
  let admin: TestAdmin;

  test.beforeAll(() => {
    admin = createTestAdmin(`e2e-admin-${runId}@example.com`, "E2E Admin");
  });

  test.afterAll(async () => {
    await deleteOrdersMatching(runId);
    await deleteProductsMatching(runId);
    await deleteUnusedUploadsSince(startedAt);
    await deleteUsersMatching(runId);
    await deleteOutboxEmails(runId);
    await closeDb();
  });

  async function enterPassword(page: Page, password: string) {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(admin.email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Continue" }).click();
  }

  // Tests that only need to be signed in share one sign-in: signing in again for each test
  // would trip the per-IP limit on two-step codes (3 tries per 10 seconds).
  let session: Awaited<ReturnType<BrowserContext["storageState"]>> | undefined;
  async function signedInPage(browser: Browser): Promise<Page> {
    const baseURL = test.info().project.use.baseURL;
    if (session) return (await browser.newContext({ baseURL, storageState: session })).newPage();
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await enterPassword(page, admin.password);
    await page.getByLabel("Authentication code").fill(totpCode(admin.totpSecret));
    await page.getByRole("button", { name: "Verify" }).click();
    await signInExpect(page).toHaveURL(/\/admin$/);
    session = await context.storageState();
    return page;
  }

  test("signs in with password and authenticator code, then signs out", async ({ page }) => {
    await enterPassword(page, admin.password);
    const code = page.getByLabel("Authentication code");
    await signInExpect(code).toBeFocused();
    await code.fill(totpCode(admin.totpSecret));
    await page.getByRole("button", { name: "Verify" }).click();

    await signInExpect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Welcome, E2E Admin")).toBeVisible();
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
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Welcome, E2E Admin")).toBeVisible();
  });

  test("sees the exact custom-fit measurements on the order page", async ({ browser }) => {
    const number = await insertTestOrder(`e2e-fit-${runId}@example.com`, {
      measurements: {
        kind: "women",
        unit: "cm",
        values: { bust: 91.5, waist: 74, height: 163 },
        notes: "I'll wear 3-inch heels",
      },
    });
    const page = await signedInPage(browser);
    await page.goto(`/admin/orders/${number}`);
    const measurements = page.getByTestId("measurements");
    await expect(page.getByText("Women's measurements")).toBeVisible();
    await expect(measurements.getByText("1. Bust")).toBeVisible();
    await expect(measurements.getByText("91.5 cm")).toBeVisible();
    await expect(measurements.getByText("6. Waist")).toBeVisible();
    await expect(measurements.getByText("74 cm")).toBeVisible();
    await expect(measurements.getByText("163 cm")).toBeVisible();
    await expect(page.getByText("I'll wear 3-inch heels")).toBeVisible();
    await expectNoWcagViolations(page);
  });

  test("processes an order from paid to delivered", async ({ browser }) => {
    const email = `e2e-order-${runId}@example.com`;
    const number = await insertTestOrder(email);

    const page = await signedInPage(browser);
    await page.goto("/admin");

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

  test("adds a product with a photo and publishes it to the shop", async ({ browser }) => {
    const title = `E2E silk saree ${runId}`;
    const slug = `e2e-saree-${runId}`;
    const alt = `Model wearing the E2E silk saree ${runId}`;

    const page = await signedInPage(browser);
    await page.goto("/admin");

    await page
      .getByRole("navigation", { name: "Admin" })
      .getByRole("link", { name: "Products" })
      .click();
    await expect(page.getByRole("heading", { level: 1, name: "Products" })).toBeVisible();
    await expectNoWcagViolations(page);
    await page.getByRole("link", { name: "Add product" }).click();

    // Saving too early lists the problems and keeps what was typed.
    await page.getByLabel("Name", { exact: true }).fill(title);
    await expect(page.getByLabel("Web address")).toHaveValue(`e2e-silk-saree-${runId}`);
    await page.getByRole("button", { name: "Save product" }).click();
    const problems = page.getByRole("alert").filter({ hasText: "need fixing before saving" });
    await expect(problems).toBeFocused();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(title);

    await page.getByLabel("Web address").fill(slug);
    await page
      .getByLabel("Description", { exact: true })
      .fill("A ruby silk saree with a woven gold border, made for the browser tests.");
    await page.getByLabel("Category").selectOption("saree");
    await page.getByLabel("Fabric").fill("Silk");
    await page.getByLabel("Work (embroidery or weave)").fill("Zari weave");
    await page.getByLabel("Colour").fill("Red");
    await page.getByLabel("HS code (customs)").fill("6204.44");
    await page.getByLabel("Wedding").check();
    await page.getByLabel("Care instructions").fill("Dry clean only.");
    await page.getByLabel("Price (USD)", { exact: true }).fill("349");

    await page.getByRole("button", { name: "Add size" }).click();
    await page.getByRole("textbox", { name: /^Size/ }).fill("One size");
    await page.getByRole("textbox", { name: /^Stock/ }).fill("3");

    await page.getByLabel("Add photos").setInputFiles("tests/e2e/fixtures/product-photo.webp");
    const altInput = page.getByLabel("Description for screen readers");
    await expect(altInput).toBeFocused({ timeout: 15_000 });
    await altInput.fill(alt);

    await page.getByLabel("Published: on sale in the shop").check();
    await page.getByRole("button", { name: "Save product" }).click();
    // Publishing refreshes the shop's cached pages, which is slow on a busy machine or CI runner.
    await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}\?created=1$/, {
      timeout: 20_000,
    });
    await expect(page.getByRole("status").filter({ hasText: "Product created." })).toBeVisible();
    await expectNoWcagViolations(page);

    // It's in the shop, with its uploaded photo.
    await page.goto(`/p/${slug}`);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByText("$349.00").first()).toBeVisible();
    const photo = page.getByRole("img", { name: alt }).first();
    await expect(photo).toBeVisible();
    await expect
      .poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
  });

  test("the dashboard sums up the shop and the admin log shows every change", async ({
    browser,
  }) => {
    const page = await signedInPage(browser);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    await expect(page.getByTestId("sales-tile")).toHaveCount(3);
    await expect(page.getByRole("heading", { level: 2, name: "Needs action" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^To confirm \d+ orders?$/ })).toBeVisible();
    await expectNoWcagViolations(page);

    await page
      .getByRole("navigation", { name: "Admin" })
      .getByRole("link", { name: "Admin log" })
      .click();
    await expect(page.getByRole("heading", { level: 1, name: "Admin log" })).toBeVisible();
    const log = page.getByTestId("admin-log");
    // The earlier tests in this file processed an order and added a product as "E2E Admin".
    const productRow = log.getByRole("row").filter({ hasText: `E2E silk saree ${runId}` });
    await expect(productRow.first()).toContainText("Added a product");
    await expect(productRow.first()).toContainText("E2E Admin");
    await expect(
      log.getByRole("row").filter({ hasText: "Changed order status" }).first(),
    ).toContainText("Shipped");
    await expectNoWcagViolations(page);

    await page
      .getByRole("navigation", { name: "Show changes to" })
      .getByRole("link", { name: "Products" })
      .click();
    await expect(page).toHaveURL(/entity=product/);
    await expect(log.getByRole("row").filter({ hasText: "Changed order status" })).toHaveCount(0);
  });
});

async function outboxCount(tag: string, email: string): Promise<number> {
  const safe = email.replace(/[^a-z0-9]+/gi, "_").slice(0, 40);
  const files = await readdir(".outbox").catch(() => [] as string[]);
  return files.filter((f) => f.includes(tag) && f.includes(safe)).length;
}
