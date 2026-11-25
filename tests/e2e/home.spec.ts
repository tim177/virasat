import { expect, test } from "@playwright/test";

test("home page shows the hero, trust points and categories", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("your celebrations");
  await expect(page.getByRole("region", { name: "Why shop with Virasat" })).toContainText(
    "Duties & taxes included",
  );
  const categories = page.getByRole("region", { name: "Shop by category" });
  await expect(categories.getByRole("link")).toHaveCount(5);
});

test("seeded products show with photos served by the image optimizer", async ({ page }) => {
  await page.goto("/");
  const arrivals = page.getByRole("region", { name: "New arrivals" });
  const cards = arrivals.getByRole("article");
  await expect(cards).toHaveCount(4);

  const photos = arrivals.getByRole("img");
  await expect(photos).toHaveCount(4);
  for (const photo of await photos.all()) {
    await photo.scrollIntoViewIfNeeded();
    await expect(photo).toHaveAttribute("src", /\/_next\/image\?url=%2Fseed%2F.+\.webp/);
    await expect
      .poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
      .toBe(true);
  }
});

test("health endpoint reports the database is up", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ status: "ok", database: "up" });
});
