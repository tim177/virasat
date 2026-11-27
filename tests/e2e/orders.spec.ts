import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { signInAsCustomer } from "./helpers/customer";
import {
  accessTokenFor,
  closeDb,
  deleteOrdersMatching,
  deleteUsersMatching,
  insertTestOrder,
} from "./helpers/db";
import { deleteOutboxEmails } from "./helpers/outbox";

// Orders for customers (v1 spec, Step 7): the order page from the email link, and past guest
// orders showing up in the account after signing in with the same email.

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const runId = randomUUID().slice(0, 8);
const measurements = {
  kind: "women",
  unit: "cm",
  values: { bust: 91.5, waist: 74, height: 163 },
  notes: "I'll wear 3-inch heels",
};

test.afterAll(async () => {
  await deleteOrdersMatching(runId);
  await deleteUsersMatching(runId);
  await deleteOutboxEmails(runId);
  await closeDb();
});

test("the email link opens the order without signing in", async ({ page }, testInfo) => {
  const number = await insertTestOrder(`e2e-link-${testInfo.project.name}-${runId}@example.com`, {
    measurements,
  });
  const token = await accessTokenFor(number);

  await page.goto(`/orders/${number}?t=${token}`);
  await expect(page.getByRole("heading", { level: 1, name: `Order ${number}` })).toBeVisible();
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");

  // Status changes only: the internal note on the "paid" event never shows.
  const timeline = page.getByRole("region", { name: "Order status" });
  await expect(timeline.getByText("Payment received")).toBeVisible();
  await expect(timeline.getByText("We check your order")).toBeVisible();
  await expect(page.getByText("Paid $680.00")).toHaveCount(0);

  // Custom fit: the fit-call button with the order filled in, and the measurements.
  const book = page.getByRole("link", { name: "Book your fit call" });
  await expect(book).toHaveAttribute("href", /^https:\/\/cal\.com\/virasat-test\/fit-call\?/);
  await expect(book).toHaveAttribute("href", new RegExp(`metadata%5Border%5D=${number}`));
  const shown = page.getByTestId("measurements");
  await expect(shown.getByText("1. Bust")).toBeVisible();
  await expect(shown.getByText("91.5 cm")).toBeVisible();
  await expect(page.getByText("We'll email you the tracking link")).toBeVisible();

  const axe = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  // A wrong or missing token shows nothing about the order.
  await page.goto(`/orders/${number}?t=${token.slice(0, -2)}xx`);
  await expect(
    page.getByRole("heading", { level: 1, name: "We couldn't find this order" }),
  ).toBeVisible();
  await expect(page.getByText("Asha Rao")).toHaveCount(0);
  await page.goto(`/orders/${number}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "We couldn't find this order" }),
  ).toBeVisible();
});

test("a guest's past order appears in the account after signing in", async ({ page, isMobile }) => {
  test.skip(isMobile, "Runs on the desktop project: each sign-in sends a code");
  const email = `e2e-guest-${runId}@example.com`;
  const number = await insertTestOrder(email);

  await signInAsCustomer(page, email);
  const orders = page.getByTestId("account-orders");
  await expect(orders.getByRole("link", { name: number })).toBeVisible();
  await expect(orders.getByText("Paid")).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  await orders.getByRole("link", { name: number }).click();
  await expect(page.getByRole("heading", { level: 1, name: `Order ${number}` })).toBeVisible();
  await expect(page.getByText("Blush organza lehenga")).toBeVisible();
  await expect(page.getByText("Size S (US 4–6)")).toBeVisible();

  // Someone else's order number looks like one that doesn't exist.
  const other = await insertTestOrder(`e2e-other-${runId}@example.com`);
  await page.goto(`/account/orders/${other}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "We couldn't find this order" }),
  ).toBeVisible();
});
