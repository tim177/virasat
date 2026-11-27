import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { tabTo } from "./helpers/customer";

// The custom-fit measurement form (v1 spec, Step 7), used by keyboard only: choose custom fit,
// enter measurements in centimetres, fix the errors, add to the bag, then edit from the bag.

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const PRODUCT = "/p/blush-organza-lehenga";

// In form order (the numbers on the diagram).
const CENTIMETRES: Array<[string, string]> = [
  ["Bust", "91.5"],
  ["Under bust", "78"],
  ["Shoulder width", "37.25"],
  ["Armhole", "40"],
  ["Upper arm", "28"],
  ["Waist", "74"],
  ["Hip", "99"],
  ["Shoulder to waist", "38"],
  ["Sleeve length", "20.5"],
  ["Waist to floor", "104"],
  ["Height", "163"],
];

async function expectNoWcagViolations(page: Page) {
  const results = await new AxeBuilder({ page }).include("dialog[open]").withTags(WCAG).analyze();
  expect(
    results.violations.map((v) => ({
      rule: v.id,
      targets: v.nodes.map((n) => n.target.join(" ")),
    })),
  ).toEqual([]);
}

test("custom fit: enter measurements by keyboard, add to bag, edit from the bag", async ({
  page,
}) => {
  await page.goto(PRODUCT);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // Choose custom fit with the arrow keys inside the size group.
  const custom = page.getByRole("radio", { name: /Custom fit/ });
  await tabTo(page, page.getByRole("radio").first());
  for (let i = 0; i < 10 && !(await custom.isChecked()); i += 1) {
    await page.keyboard.press("ArrowLeft");
  }
  await expect(custom).toBeChecked();

  const enter = page.getByRole("button", { name: "Enter measurements" });
  await tabTo(page, enter);
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Your measurements" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("img", { name: /Where to measure/ })).toBeVisible();
  await expectNoWcagViolations(page);

  // Switch to centimetres with the arrow keys.
  await tabTo(page, dialog.getByRole("radio", { name: "Inches" }));
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByRole("radio", { name: "Centimetres" })).toBeChecked();

  // Submitting empty lists every measurement, with focus on the summary.
  await tabTo(page, dialog.getByRole("button", { name: "Add to bag" }));
  await page.keyboard.press("Enter");
  const summary = dialog.getByRole("alert").filter({ hasText: "11 measurements need checking" });
  await expect(summary).toBeFocused();
  await expect(summary.getByRole("link")).toHaveCount(11);
  await expectNoWcagViolations(page);

  // The summary's first link jumps to the field; then Tab through the form, typing each value.
  await page.keyboard.press("Tab");
  await expect(summary.getByRole("link", { name: "1. Bust" })).toBeFocused();
  await page.keyboard.press("Enter");
  for (const [index, [label, value]] of CENTIMETRES.entries()) {
    const field = dialog.getByLabel(`${index + 1}. ${label} (cm)`);
    if (index > 0) await page.keyboard.press("Tab");
    await expect(field).toBeFocused();
    // One wrong value first, to see the range check.
    await page.keyboard.type(index === 0 ? "36" : value);
  }
  await page.keyboard.press("Tab");
  await page.keyboard.type("I'll wear 3-inch heels");

  await tabTo(page, dialog.getByRole("button", { name: "Add to bag" }));
  await page.keyboard.press("Enter");
  await expect(
    dialog.getByRole("alert").filter({ hasText: "1 measurement needs checking" }),
  ).toBeFocused();
  await expect(dialog.getByText("Enter a number between 71 and 152 cm.")).toBeVisible();
  const bust = dialog.getByLabel("1. Bust (cm)");
  await tabTo(page, bust);
  await page.keyboard.press("Control+A");
  await page.keyboard.type("91.5");
  await tabTo(page, dialog.getByRole("button", { name: "Add to bag" }));
  await page.keyboard.press("Enter");

  // Closed, focus back where it was, piece in the bag.
  await expect(dialog).toBeHidden();
  await expect(enter).toBeFocused();
  await expect(page.getByText("Added to bag")).toBeVisible();

  await page.goto("/bag");
  const line = page.getByTestId("bag-line");
  await expect(line).toHaveCount(1);
  await expect(line.getByText("Women's measurements · Centimetres")).toBeVisible();
  await expect(page.getByRole("button", { name: "Checkout" })).not.toHaveAttribute(
    "aria-disabled",
    "true",
  );

  // Editing starts from what was entered; Escape closes and returns focus.
  const edit = line.getByRole("button", { name: "Edit measurements for Blush organza lehenga" });
  await tabTo(page, edit);
  await page.keyboard.press("Enter");
  const editDialog = page.getByRole("dialog", { name: "Edit your measurements" });
  await expect(editDialog.getByLabel("1. Bust (cm)")).toHaveValue("91.5");
  await expect(editDialog.getByLabel("Anything else for the tailor?")).toHaveValue(
    "I'll wear 3-inch heels",
  );
  await page.keyboard.press("Escape");
  await expect(editDialog).toBeHidden();
  await expect(edit).toBeFocused();

  const stored = await page.evaluate(() => localStorage.getItem("virasat:bag:v1"));
  expect(JSON.parse(stored ?? "[]")[0].measurements).toEqual({
    kind: "women",
    unit: "cm",
    values: Object.fromEntries(
      [
        "bust",
        "underBust",
        "shoulder",
        "armhole",
        "upperArm",
        "waist",
        "hip",
        "shoulderToWaist",
        "sleeveLength",
        "waistToFloor",
        "height",
      ].map((key, i) => [key, Number(CENTIMETRES[i][1])]),
    ),
    notes: "I'll wear 3-inch heels",
  });
});

test("a custom-fit line without measurements can't go to checkout", async ({ page }) => {
  await page.goto("/bag");
  const slug = "blush-organza-lehenga";
  await page.evaluate((productSlug) => {
    localStorage.setItem(
      "virasat:bag:v1",
      JSON.stringify([{ id: "c1", productSlug, variantId: null, custom: true, quantity: 1 }]),
    );
  }, slug);
  await page.reload();
  await expect(page.getByText("Add your measurements to continue.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Checkout" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await expect(
    page.getByRole("button", { name: "Add measurements for Blush organza lehenga" }),
  ).toBeVisible();
});
