import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("a workspace member sees privacy-preserving redirect aggregates", async ({ page }) => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const workspaceHandle = `analytics${suffix}`;

  await page.goto("/");
  await page.getByRole("button", { name: "Create a workspace" }).click();
  await page.getByLabel("Your name").fill("Analytics Owner");
  await page.getByLabel("Email").fill(`analytics-${suffix}@example.test`);
  await page.getByLabel("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Continue to sign in" }).click();
  await page.getByRole("button", { exact: true, name: "Sign in" }).click();
  await page.getByLabel("Workspace name").fill("Analytics Workspace");
  await page.getByLabel("Workspace handle").fill(workspaceHandle);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.getByLabel("Destination URL").fill("https://93.184.216.34/analytics");
  await page.getByRole("button", { name: "Publish link" }).click();

  const linkText = await page
    .getByText(new RegExp(`${workspaceHandle}/c[a-z0-9]{24}`))
    .textContent();
  const slug = linkText?.match(/c[a-z0-9]{24}/)?.[0];
  expect(slug).toBeTruthy();

  const redirect = await page.request.get(`http://${workspaceHandle}.localhost:8080/${slug}`, {
    headers: { referer: "https://source.example/private-marker", "user-agent": "private-marker" },
    maxRedirects: 0,
  });
  expect(redirect.status()).toBe(302);

  await page.reload();

  await expect(page.getByRole("heading", { name: "Redirect performance" })).toBeVisible();
  await expect(page.getByText("TOTAL CLICKS")).toBeVisible();
  await expect(page.getByText("DAILY UNIQUE LINK VISITORS", { exact: true })).toBeVisible();
  await expect(page.getByText("Unknown")).toBeVisible();
  await expect(page.getByText("private-marker")).toHaveCount(0);
});
