import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// The bag, without paying (no Stripe needed, so this runs in CI).

async function addSize(page: Page, slug: string, size: string) {
  await page.goto(`/p/${slug}`);
  await page.getByText(size, { exact: true }).click();
  await page.getByRole("button", { name: "Add to bag" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Added to bag" })).toBeVisible();
}

test("add to bag, change quantity, remove, and see the empty bag", async ({ page }) => {
  await addSize(page, "blush-organza-lehenga", "S (US 4–6)");

  // The header shows the count, and the toast links to the bag.
  await expect(page.getByRole("link", { name: "Bag, 1 item" })).toBeVisible();
  await page.getByRole("link", { name: "View bag" }).click();
  await expect(page).toHaveURL(/\/bag$/);

  const line = page.getByTestId("bag-line");
  await expect(line).toHaveCount(1);
  await expect(line).toContainText("Blush organza lehenga");
  await expect(line).toContainText("Size S (US 4–6)");
  await expect(page.getByTestId("bag-total")).toHaveText("$680.00");

  await page.getByRole("button", { name: "Increase quantity of Blush organza lehenga" }).click();
  await expect(page.getByTestId("bag-total")).toHaveText("$1,360.00");
  await expect(page.getByRole("link", { name: "Bag, 2 items" })).toBeVisible();

  await page.getByRole("button", { name: "Decrease quantity of Blush organza lehenga" }).click();
  await expect(page.getByTestId("bag-total")).toHaveText("$680.00");

  await page.getByRole("button", { name: "Remove Blush organza lehenga from bag" }).click();
  await expect(page.getByRole("heading", { name: "Your bag is empty" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Bag, empty" })).toBeVisible();
});

test("the bag survives a reload and adding the same size again adds one more", async ({ page }) => {
  await addSize(page, "sage-linen-kurta-set", 'M (chest 38")');
  await addSize(page, "sage-linen-kurta-set", 'M (chest 38")');
  await page.goto("/bag");
  await page.reload();
  await expect(page.getByTestId("bag-line")).toHaveCount(1);
  await expect(page.getByTestId("bag-total")).toHaveText("$360.00");
});

test("custom fit is its own line with the extra price", async ({ page }) => {
  await page.goto("/p/emerald-velvet-lehenga");
  await page.getByText("Custom fit", { exact: true }).click();
  await page.getByRole("button", { name: "Add to bag" }).click();
  await page.goto("/bag");
  const line = page.getByTestId("bag-line");
  await expect(line).toContainText("Custom fit");
  await expect(page.getByTestId("bag-total")).toHaveText("$980.00");
});

test("bag page has no WCAG violations", async ({ page }) => {
  await addSize(page, "blush-organza-lehenga", "S (US 4–6)");
  await page.goto("/bag");
  await expect(page.getByTestId("bag-line")).toHaveCount(1);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test("the server decides prices and catches sold-out sizes", async ({ page, request }) => {
  await page.goto("/p/blush-organza-lehenga");
  const soldOutId = await page.getByRole("radio", { name: /M \(US 8–10\)/ }).getAttribute("value");
  const inStockId = await page.getByRole("radio", { name: /S \(US 4–6\)/ }).getAttribute("value");

  const quote = await request.post("/api/bag/quote", {
    data: {
      lines: [
        {
          id: "a",
          productSlug: "blush-organza-lehenga",
          variantId: inStockId,
          custom: false,
          quantity: 1,
        },
        {
          id: "b",
          productSlug: "blush-organza-lehenga",
          variantId: soldOutId,
          custom: false,
          quantity: 1,
        },
      ],
    },
  });
  expect(quote.status()).toBe(200);
  const bag = await quote.json();
  expect(bag.ok).toBe(false);
  expect(bag.lines.map((l: { problem: string | null }) => l.problem)).toEqual([null, "sold_out"]);
  expect(bag.subtotalCents).toBe(68000);

  // A tampered request (price in the body, silly quantity) is rejected outright.
  const tampered = await request.post("/api/checkout", {
    data: {
      lines: [
        {
          id: "a",
          productSlug: "blush-organza-lehenga",
          variantId: inStockId,
          custom: false,
          quantity: 99,
          priceCents: 1,
        },
      ],
    },
  });
  expect(tampered.status()).toBe(400);

  // Checkout refuses a bag with a sold-out size, and says which line.
  const refused = await request.post("/api/checkout", {
    data: {
      lines: [
        {
          id: "b",
          productSlug: "blush-organza-lehenga",
          variantId: soldOutId,
          custom: false,
          quantity: 1,
        },
      ],
    },
  });
  expect(refused.status()).toBe(409);
  expect((await refused.json()).error).toBe("bag_changed");
});

test("the confirmation page never invents an order", async ({ page }) => {
  await page.goto("/checkout/success?session_id=not-a-session");
  await expect(page.getByRole("heading", { name: "We couldn't find this checkout" })).toBeVisible();
  await page.goto("/checkout/success?session_id=cs_test_doesnotexist000000");
  await expect(page.getByRole("heading", { name: "Confirming your payment…" })).toBeVisible();
});

test("the email retry job needs the secret", async ({ request }) => {
  expect((await request.post("/api/cron/emails")).status()).toBe(401);
  expect(
    (
      await request.post("/api/cron/emails", { headers: { Authorization: "Bearer wrong" } })
    ).status(),
  ).toBe(401);
});
