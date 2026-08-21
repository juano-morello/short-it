import { expect, test } from "@playwright/test";

test("serves the short.it dashboard through the app host", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("short.it");
  await expect(page.getByRole("heading", { name: /short link worth tracking/i })).toBeVisible();
});
