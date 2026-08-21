import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("a visitor creates an owner workspace", async ({ page }) => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);

  await page.goto("/");
  await page.getByRole("button", { name: "Create a workspace" }).click();

  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();

  await page.getByLabel("Your name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill(`ada-${suffix}@example.test`);
  await page.getByLabel("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Continue to sign in" }).click();

  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { name: "Create your workspace" })).toBeVisible();
  await page.getByLabel("Workspace name").fill("Ada Studio");
  await page.getByLabel("Workspace handle").fill(`ada-${suffix}`);
  await page.getByRole("button", { name: "Create workspace" }).click();

  await expect(page.getByRole("heading", { name: "Ada Studio" })).toBeVisible();
  await expect(page.getByText("Owner", { exact: true })).toBeVisible();

  await page.getByLabel("Destination URL").fill("https://93.184.216.34/portfolio");
  await page.getByRole("button", { name: "Publish link" }).click();

  await expect(page.getByText(new RegExp(`ada-${suffix}/c[a-z0-9]{24}`))).toBeVisible();
});
