import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { closeDb, deleteOrdersMatching, orderItems, ordersByEmail } from "./helpers/db";
import { deleteOutboxEmails } from "./helpers/outbox";

// The real purchase: our bag → Stripe's hosted page (test mode) → webhook → order → email.
// Needs real Stripe test keys in .env and webhooks forwarded to the test server:
//   terminal 1: pnpm stripe:listen 3300
//   terminal 2: pnpm build && STRIPE_E2E=1 CI=1 E2E_PORT=3300 pnpm exec playwright test tests/e2e/purchase.spec.ts --project=desktop
// Skipped in CI, which never talks to Stripe.

test.skip(
  !process.env.STRIPE_E2E,
  "Set STRIPE_E2E=1 with Stripe test keys and `pnpm stripe:listen` running",
);
// Stripe's page is a desktop flow here; real Chrome loads it more reliably than the test shell.
test.use({ channel: "chrome" });
test.describe.configure({ mode: "serial" });

const runId = randomUUID().slice(0, 8);
const emailFor = (label: string) => `e2e-${label}-${runId}@example.com`;

test.afterAll(async () => {
  // Remove the test orders so repeated runs don't pile up.
  await deleteOrdersMatching(runId);
  await deleteOutboxEmails(runId);
  await closeDb();
});

async function fillStripeCheckout(page: Page, email: string, cardNumber: string) {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60_000 });
  const form = page.frameLocator('iframe[src*="elements-inner-habanero"]');
  await form.locator("#linkAuthentication-emailInput").fill(email, { timeout: 60_000 });
  await form.locator("#shippingAddress-nameInput").fill("Asha Rao");
  const line1 = form.locator("#shippingAddress-addressLine1Input");
  await line1.fill("1 Main St");
  await line1.press("Escape"); // close the address suggestions
  await form.locator("#shippingAddress-localityInput").fill("Edison");
  await form
    .locator("#shippingAddress-administrativeAreaInput")
    .selectOption("NJ", { force: true });
  await form.locator("#shippingAddress-postalCodeInput").fill("08817");
  await form.locator("#shippingAddress-phoneInput").fill("2025550123");
  await form.getByRole("button", { name: /^Card/ }).click();
  await form.locator("#payment-numberInput").fill(cardNumber);
  await form.locator("#payment-expiryInput").fill("12 / 34");
  await form.locator("#payment-cvcInput").fill("123");
  await form.getByTestId("payment-form-submit-button").click();
}

/** Presses "Complete" on Stripe's 3-D Secure test page once it has really loaded. */
async function completeThreeDSecure(page: Page) {
  await expect
    .poll(
      async () => {
        for (const frame of page.frames()) {
          if (!frame.url().includes("3d_secure_2_test")) continue;
          const complete = frame.locator("#test-source-authorize-3ds");
          if (await complete.isVisible().catch(() => false)) {
            // A mouse click is swallowed by an invisible layer over Stripe's test pop-up in
            // headless Chrome; pressing Enter on the focused button works like a real user.
            await complete.focus();
            await page.keyboard.press("Enter");
            return true;
          }
        }
        return false;
      },
      { timeout: 60_000, intervals: [1_000] },
    )
    .toBe(true);
}

for (const card of [
  { name: "a standard card", number: "4242424242424242", threeDSecure: false },
  { name: "a 3-D Secure card", number: "4000002500003155", threeDSecure: true },
]) {
  test(`buy with ${card.name}: order saved once, email sent, bag emptied`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "One run is enough: Stripe's page is the same");
    test.setTimeout(240_000);
    const email = emailFor(card.threeDSecure ? "3ds" : "card");

    // Our shop: product → bag → checkout (made-to-order size, so stock never runs out).
    await page.goto("/p/maroon-jacquard-sherwani");
    await page.getByText('M (chest 38")', { exact: true }).click();
    await page.getByRole("button", { name: "Add to bag" }).click();
    await page.goto("/bag");
    await expect(page.getByTestId("bag-total")).toHaveText("$640.00");
    await page.getByRole("button", { name: "Checkout" }).click();

    // Stripe's hosted page (test mode).
    await fillStripeCheckout(page, email, card.number);
    if (card.threeDSecure) await completeThreeDSecure(page);

    // Back on our confirmation page, which waits for the webhook to create the order.
    await page.waitForURL(/\/checkout\/success\?session_id=cs_test_/, { timeout: 90_000 });
    const orderNumber = page.getByTestId("order-number");
    await expect(orderNumber).toHaveText(/^VRS-\d+$/, { timeout: 60_000 });
    await expect(page.getByTestId("order-total")).toHaveText("$640.00");
    await expect(page.getByRole("link", { name: "Bag, empty" })).toBeVisible();

    // The database has exactly one paid order for this payment, with the item snapshot.
    const orders = await ordersByEmail(email);
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({
      number: (await orderNumber.textContent())?.trim(),
      status: "paid",
      currency: "USD",
      subtotal_cents: 64000,
      total_cents: 64000,
      customer_name: "Asha Rao",
    });
    expect(orders[0].stripe_payment_intent_id).toMatch(/^pi_/);
    expect(await orderItems(orders[0].id)).toEqual([
      {
        title_snapshot: "Maroon jacquard sherwani",
        size: 'M (chest 38")',
        unit_price_cents: 64000,
        quantity: 1,
      },
    ]);

    // The confirmation email goes out right after the webhook replies.
    await expect
      .poll(async () => (await ordersByEmail(email))[0]?.confirmation_sent_at ?? null, {
        timeout: 30_000,
      })
      .not.toBeNull();

    // Refreshing the confirmation page shows the same order and creates nothing new.
    await page.reload();
    await expect(page.getByTestId("order-number")).toHaveText(orders[0].number);
    expect(await ordersByEmail(email)).toHaveLength(1);
  });
}
