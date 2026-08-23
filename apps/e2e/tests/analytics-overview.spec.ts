import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("a workspace member sees privacy-preserving redirect aggregates", async ({ page }) => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const workspaceHandle = `analytics${suffix}`;
  const publicOrigin = new URL(process.env.E2E_BASE_URL ?? "http://app.localhost:8080");
  publicOrigin.hostname = `${workspaceHandle}.localhost`;

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
    .getByRole("link", {
      name: new RegExp(`http://${workspaceHandle}\\.localhost:8080/c[a-z0-9]{24}`),
    })
    .first()
    .textContent();
  const slug = linkText?.match(/c[a-z0-9]{24}/)?.[0];
  expect(slug).toBeTruthy();

  const redirect = await page.request.get(new URL(`/${slug}`, publicOrigin).href, {
    headers: { referer: "https://source.example/private-marker", "user-agent": "private-marker" },
    maxRedirects: 0,
  });
  expect(redirect.status()).toBe(302);

  await expect
    .poll(async () => {
      const overviewResponse = page.waitForResponse(
        (response) =>
          response.request().method() === "GET" &&
          response.url().includes(`/api/organizations/`) &&
          response.url().endsWith("/analytics") &&
          response.status() === 200,
      );
      await page.reload();
      const overview = (await (await overviewResponse).json()) as {
        breakdowns: { countries: Array<{ value: string }> };
      };
      return overview.breakdowns.countries.some((country) => country.value === "Unknown");
    })
    .toBe(true);

  await page.getByRole("link", { exact: true, name: "Analytics" }).click();
  await expect(page.getByRole("heading", { name: "Redirect performance" })).toBeVisible();
  await expect(page.getByText("TOTAL CLICKS")).toBeVisible();
  await expect(page.getByText("DAILY UNIQUE LINK VISITORS", { exact: true })).toBeVisible();
  await expect(page.getByText("Unknown")).toBeVisible();
  await expect(page.getByText("private-marker")).toHaveCount(0);
});
