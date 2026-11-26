import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Browse flow: home → category → filters/sort → product → size choice; plus search and SEO.
// Runs on the phone and desktop projects against the seeded sample catalogue.

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoAxeViolations(page: Page, include?: string) {
  let builder = new AxeBuilder({ page }).withTags(WCAG_TAGS);
  if (include) builder = builder.include(include);
  const { violations } = await builder.analyze();
  expect(
    violations.map((v) => ({ rule: v.id, targets: v.nodes.map((n) => n.target.join(" ")) })),
  ).toEqual([]);
}

async function expectNoSideways(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "page scrolls sideways").toBeLessThanOrEqual(0);
}

const isMobile = (name: string) => name === "mobile";

/** Opens the filter form: inline on desktop, in the drawer on phones. */
async function openFilters(page: Page, projectName: string) {
  if (isMobile(projectName)) {
    await page.getByRole("button", { name: /^Filters/ }).click();
    return page.getByRole("dialog", { name: "Filters" });
  }
  return page.getByRole("complementary", { name: "Filters" });
}

test("browse from home to a product and choose a size", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("region", { name: "Shop by category" })
    .getByRole("link", { name: "Lehengas" })
    .click();

  await expect(page).toHaveURL(/\/c\/lehengas$/);
  await expect(page.getByRole("heading", { level: 1, name: "Lehengas" })).toBeVisible();
  const results = page.getByRole("region", { name: "Results" });
  await expect(results.getByRole("article")).toHaveCount(4);

  await results.getByRole("link", { name: "Blush organza lehenga" }).click();
  await expect(page).toHaveURL(/\/p\/blush-organza-lehenga$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Blush organza lehenga" }),
  ).toBeVisible();

  // Add to bag before choosing: it's aria-disabled (still focusable, so the reason can be read).
  // Pressing it explains why and moves focus to the sizes. Playwright won't click
  // aria-disabled buttons, so press it from the keyboard like a keyboard user would.
  const addToBag = page.getByRole("button", { name: "Add to bag" });
  await expect(addToBag).toHaveAttribute("aria-disabled", "true");
  await addToBag.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Please choose a size or custom fit first.")).toBeVisible();
  await expect(page.getByRole("radio", { name: "XS (US 0–2)" })).toBeFocused();

  // Sold-out sizes can't be chosen; custom fit shows its extra price.
  await expect(page.getByRole("radio", { name: /^M \(US 8–10\).*sold out/i })).toBeDisabled();
  await expect(page.getByText("+$45.00 · made to your measurements")).toBeVisible();

  await page.getByText("S (US 4–6)", { exact: true }).click();
  await expect(page.getByText("Please choose a size or custom fit first.")).toBeHidden();
  await expect(page.getByTestId("delivery-estimate")).toContainText(/Arrives \w{3}, \w{3} \d+ – /);

  await expect(addToBag).not.toHaveAttribute("aria-disabled");
  await addToBag.click();
  await expect(page.getByRole("status").filter({ hasText: "Added to bag" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Bag, 1 item" })).toBeVisible();
});

test("filters and sorting update the URL and the results", async ({ page }, testInfo) => {
  await page.goto("/c/lehengas");
  const results = page.getByRole("region", { name: "Results" });
  await expect(results.getByRole("article")).toHaveCount(4);

  const filters = await openFilters(page, testInfo.project.name);
  await filters.getByRole("checkbox", { name: "Wedding" }).check();
  await filters.getByRole("button", { name: "Show results" }).click();

  await expect(page).toHaveURL(/occasion=wedding/);
  await expect(results.getByRole("article")).toHaveCount(2);
  await expect(page.getByTestId("result-count")).toHaveText("2 pieces");

  // Removing the chip brings everything back.
  await page.getByRole("link", { name: "Remove filter: Wedding" }).click();
  await expect(page).toHaveURL(/\/c\/lehengas$/);
  await expect(results.getByRole("article")).toHaveCount(4);

  await page.getByRole("link", { name: "Price: low to high" }).click();
  await expect(page).toHaveURL(/sort=price-asc/);
  await expect(results.getByRole("article").first()).toContainText("Marigold cotton-silk lehenga");
  await expect(page.getByRole("link", { name: "Price: low to high" })).toHaveAttribute(
    "aria-current",
    "true",
  );
});

test("a shared filter link works without clicking anything", async ({ page }) => {
  await page.goto("/shop?category=sherwanis&colour=Maroon");
  const results = page.getByRole("region", { name: "Results" });
  await expect(results.getByRole("article")).toHaveCount(1);
  await expect(results).toContainText("Maroon jacquard sherwani");
});

test("search understands regional spellings and handles no results", async ({ page }) => {
  await page.goto("/search");
  await page.getByRole("searchbox", { name: "Search the collection" }).fill("ghagra");
  await page.getByRole("button", { name: "Search", exact: true }).click();

  await expect(page).toHaveURL(/\/search\?q=ghagra/);
  await expect(page.getByTestId("result-count")).toHaveText("4 results for “ghagra”");

  await page.goto("/search?q=tuxedo");
  await expect(page.getByRole("heading", { name: "No results for “tuxedo”" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Browse categories" }).getByRole("link"),
  ).toHaveCount(5);
});

test("the size guide opens and closes by keyboard", async ({ page }) => {
  await page.goto("/p/maroon-jacquard-sherwani");
  const button = page.getByRole("button", { name: "Size guide" });
  await button.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Size guide" });
  await expect(dialog.getByRole("table", { name: /Men's sizes/ })).toBeVisible();
  await expectNoAxeViolations(page, "dialog[open]");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(button).toBeFocused();
});

test("product pages publish price data for search engines", async ({ page }) => {
  await page.goto("/p/blush-organza-lehenga");
  const raw = await page.locator('script[type="application/ld+json"]').textContent();
  const data = JSON.parse(raw ?? "{}");
  expect(data).toMatchObject({
    "@type": "Product",
    name: "Blush organza lehenga",
    offers: { priceCurrency: "USD", price: "680.00" },
  });
  await expect(page).toHaveTitle("Blush organza lehenga · Virasat");
});

// With Cache Components the shell may already be streaming (HTTP 200) when notFound() runs, so
// Next.js serves the not-found page with a noindex tag instead of a 404 status (documented
// behaviour). Prerendered pages that don't exist at all still get a real 404.
for (const path of ["/p/does-not-exist", "/p/gold-tissue-lehenga", "/c/not-a-category"]) {
  test(`${path} shows the not-found page and is kept out of search`, async ({ page }) => {
    const response = await page.goto(path);
    expect([200, 404]).toContain(response?.status());
    await expect(
      page.getByRole("heading", { level: 1, name: "We couldn’t find that page" }),
    ).toBeVisible();
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
    await expect(page.getByRole("link", { name: "Shop all pieces" })).toBeVisible();
  });
}

test("unknown top-level pages return a real 404", async ({ request }) => {
  expect((await request.get("/this-page-does-not-exist")).status()).toBe(404);
});

test("sitemap lists published products only; robots blocks non-live sites", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/p/crimson-silk-bridal-lehenga");
  expect(sitemap).not.toContain("gold-tissue-lehenga");
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/Disallow: \/\s*$/m);
});

for (const path of [
  "/",
  "/c/lehengas",
  "/p/crimson-silk-bridal-lehenga",
  "/search?q=silk",
  "/shop",
]) {
  test(`${path} has no WCAG violations and no sideways scrolling`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expectNoAxeViolations(page);
    await expectNoSideways(page);
  });
}

test("pages fit a 360px-wide phone", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 360, height: 740 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  for (const path of ["/", "/c/lehengas", "/p/crimson-silk-bridal-lehenga", "/search?q=silk"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoSideways(page);
  }
  await context.close();
});
