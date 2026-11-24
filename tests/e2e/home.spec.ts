import { expect, test } from "@playwright/test";

test("home page loads and reaches the database", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Virasat" })).toBeVisible();
  await expect(page.getByTestId("db-status")).toContainText("Database: connected");
});

test("health endpoint reports the database is up", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ status: "ok", database: "up" });
});
