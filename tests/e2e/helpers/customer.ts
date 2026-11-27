import { expect, type Locator, type Page } from "@playwright/test";

import { loginCodeFor } from "./outbox";

/** Signs a shopper in at /login with the code from the email (.outbox/). Ends on `next`. */
export async function signInAsCustomer(page: Page, email: string, next = "/account") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  const sentAfter = Date.now();
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await page.getByLabel("6-digit code").fill(await loginCodeFor(email, sentAfter));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${next.replace(/[/?]/g, "\\$&")}$`), {
    timeout: 15_000,
  });
}

/**
 * Presses Tab until `target` has focus, proving it can be reached by keyboard. Fails after
 * `max` presses.
 */
export async function tabTo(page: Page, target: Locator, max = 60) {
  for (let i = 0; i < max; i += 1) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}
