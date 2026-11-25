import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoAxeViolations(page: Page, include?: string) {
  let builder = new AxeBuilder({ page }).withTags(WCAG_TAGS);
  if (include) builder = builder.include(include);
  const results = await builder.analyze();
  const summary = results.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    targets: v.nodes.map((n) => n.target.join(" ")),
  }));
  expect(summary).toEqual([]);
}

test.describe("design system", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dev/components");
    await expect(page.getByRole("heading", { level: 1, name: "Design system" })).toBeVisible();
  });

  test("components page has no WCAG violations", async ({ page }) => {
    await expectNoAxeViolations(page);
  });

  test("every button and header/footer/breadcrumb link is at least 44px", async ({ page }) => {
    const targets = await page
      .locator(
        "main button:visible, header a:visible, header button:visible, footer a:visible, nav[aria-label='Breadcrumb'] a:visible",
      )
      .evaluateAll((elements) =>
        elements.map((el) => {
          const box = el.getBoundingClientRect();
          return {
            name: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim(),
            width: Math.round(box.width),
            height: Math.round(box.height),
          };
        }),
      );

    expect(targets.length).toBeGreaterThan(10);
    const tooSmall = targets.filter((t) => t.width < 44 || t.height < 44);
    expect(tooSmall).toEqual([]);
  });

  test("keyboard focus is always visible", async ({ page }) => {
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press("Tab");
      const focus = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const style = getComputedStyle(el);
        return {
          name: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40),
          outlineStyle: style.outlineStyle,
          outlineWidth: parseFloat(style.outlineWidth),
        };
      });
      expect(focus, `tab stop ${i + 1}`).not.toBeNull();
      expect(focus?.outlineStyle, `outline on "${focus?.name}"`).not.toBe("none");
      expect(focus?.outlineWidth, `outline width on "${focus?.name}"`).toBeGreaterThanOrEqual(2);
    }
  });

  test("modal opens by keyboard, closes with Escape and returns focus", async ({ page }) => {
    const opener = page.getByRole("button", { name: "Open modal" });
    await opener.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: "Size guide" });
    await expect(dialog).toBeVisible();
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest("dialog")))).toBe(
      true,
    );
    await expectNoAxeViolations(page, "dialog[open]");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("drawer closes from its close button and returns focus", async ({ page }) => {
    const opener = page.getByRole("button", { name: "Open drawer" });
    await opener.click();
    const drawer = page.getByRole("dialog", { name: "Filters" });
    await expect(drawer).toBeVisible();

    await drawer.getByRole("button", { name: "Close" }).click();
    await expect(drawer).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("toasts are announced and can be dismissed", async ({ page }) => {
    await page.getByRole("button", { name: "Show success toast" }).click();
    const toast = page.getByRole("status").filter({ hasText: "Added to bag" });
    await expect(toast).toBeVisible();
    await toast.getByRole("button", { name: "Dismiss notification" }).click();
    await expect(toast).toBeHidden();
  });

  test("gallery thumbnails switch the main photo", async ({ page }) => {
    const gallery = page.getByRole("region", { name: "Photos of Crimson silk lehenga" });
    await gallery.getByRole("button", { name: "Show photo 2 of 3" }).click();
    await expect(gallery.getByRole("img", { name: "Detail of the zardozi border" })).toBeVisible();
    await gallery.getByRole("button", { name: "Next photo" }).click();
    await expect(gallery.getByRole("img", { name: "Back view of the blouse" })).toBeVisible();
  });
});

test.describe("site chrome", () => {
  test("home page has no WCAG violations", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("region", { name: "New arrivals" }).getByRole("article"),
    ).toHaveCount(4);
    await expectNoAxeViolations(page);
  });

  test("skip link moves focus to the main content", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();
  });

  test("mobile menu opens and closes by keyboard", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "The menu button only shows on small screens");
    await page.goto("/");

    const menuButton = page.getByRole("button", { name: "Open menu" });
    await menuButton.focus();
    await page.keyboard.press("Enter");

    const drawer = page.getByRole("dialog", { name: "Menu" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("link", { name: "Lehengas" })).toBeVisible();
    await expectNoAxeViolations(page, "dialog[open]");

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(menuButton).toBeFocused();
  });
});
