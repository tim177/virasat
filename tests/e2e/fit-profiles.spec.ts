import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { signInAsCustomer } from "./helpers/customer";
import { closeDb, deleteUsersMatching } from "./helpers/db";
import { deleteOutboxEmails } from "./helpers/outbox";

// Fit profiles (v1 spec, Step 7): save measurements in the account, use them for a custom-fit
// piece, save changes back, and delete the profile.

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const runId = randomUUID().slice(0, 8);
const email = `e2e-fit-${runId}@example.com`;

// In inches, in form order.
const INCHES: Array<[string, string]> = [
  ["Bust", "36"],
  ["Under bust", "31"],
  ["Shoulder width", "14.5"],
  ["Armhole", "16"],
  ["Upper arm", "11"],
  ["Waist", "29"],
  ["Hip", "39"],
  ["Shoulder to waist", "15"],
  ["Sleeve length", "8"],
  ["Waist to floor", "41"],
  ["Height", "64"],
];

// Desktop only: each sign-in sends a code, and codes are limited per IP.
test.skip(({ isMobile }) => isMobile, "Runs on the desktop project");

test.afterAll(async () => {
  await deleteUsersMatching(runId);
  await deleteOutboxEmails(runId);
  await closeDb();
});

test("a customer saves a fit profile, uses it for a piece, and deletes it", async ({ page }) => {
  await signInAsCustomer(page, email);
  await expect(page.getByText("No fit profiles yet.")).toBeVisible();

  await page.getByRole("link", { name: "Add a fit profile" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "New fit profile" })).toBeVisible();
  await page.getByLabel("Profile name").fill("Me");
  for (const [index, [label, value]] of INCHES.entries()) {
    await page.getByLabel(`${index + 1}. ${label} (in)`).fill(value);
  }
  const axe = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  await page.getByRole("button", { name: "Save measurements" }).click();

  await expect(page).toHaveURL(/\/account$/);
  const card = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: "Me", exact: true }) });
  await expect(card.getByText("Women's measurements · Inches")).toBeVisible();

  // Use it on a custom-fit piece, change the waist, and save it back to the profile.
  await page.goto("/p/blush-organza-lehenga");
  await page.getByText("Custom fit", { exact: true }).click();
  await page.getByRole("button", { name: "Enter measurements" }).click();
  const dialog = page.getByRole("dialog", { name: "Your measurements" });
  await dialog.getByLabel("Use a saved profile").selectOption({ label: "Me" });
  await dialog.getByRole("button", { name: "Use these measurements" }).click();
  await expect(dialog.getByText("Filled in from “Me”")).toBeVisible();
  await expect(dialog.getByLabel("1. Bust (in)")).toHaveValue("36");
  await dialog.getByLabel("6. Waist (in)").fill("30");
  await dialog.getByLabel("Save to my fit profiles").check();
  await expect(dialog.getByLabel("Profile name")).toHaveValue("Me");
  await dialog.getByRole("button", { name: "Add to bag" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Added to bag")).toBeVisible();

  await page.goto("/account");
  await expect(page.getByRole("heading", { level: 3, name: "Me", exact: true })).toHaveCount(1);
  await page.getByRole("link", { name: "Edit Me" }).click();
  await expect(page.getByLabel("6. Waist (in)")).toHaveValue("30");

  await page.goto("/account");
  await page.getByRole("button", { name: "Delete Me" }).click();
  const confirm = page.getByRole("dialog", { name: "Delete “Me”?" });
  await confirm.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("No fit profiles yet.")).toBeVisible();
});

test("signed-out shoppers are offered sign-in, not profiles", async ({ page }) => {
  await page.goto("/p/blush-organza-lehenga");
  await page.getByText("Custom fit", { exact: true }).click();
  await page.getByRole("button", { name: "Enter measurements" }).click();
  const dialog = page.getByRole("dialog", { name: "Your measurements" });
  await expect(
    dialog.getByRole("link", { name: "Sign in to use or save fit profiles" }),
  ).toHaveAttribute("href", "/login?next=%2Fp%2Fblush-organza-lehenga");
  await expect(dialog.getByLabel("Save to my fit profiles")).toHaveCount(0);
});
