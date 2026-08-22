import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("a tenant host exposes only a query-free public redirect", async ({ page }) => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const workspaceHandle = `redirect${suffix}`;

  await page.goto("/");
  await page.getByRole("button", { name: "Create a workspace" }).click();
  await page.getByLabel("Your name").fill("Redirect Owner");
  await page.getByLabel("Email").fill(`redirect-${suffix}@example.test`);
  await page.getByLabel("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Continue to sign in" }).click();
  await page.getByRole("button", { exact: true, name: "Sign in" }).click();
  await page.getByLabel("Workspace name").fill("Redirect Workspace");
  await page.getByLabel("Workspace handle").fill(workspaceHandle);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.getByLabel("Destination URL").fill("https://93.184.216.34/portfolio");
  await page.getByRole("button", { name: "Publish link" }).click();

  const linkText = await page
    .getByText(new RegExp(`${workspaceHandle}/c[a-z0-9]{24}`))
    .textContent();
  const slug = linkText?.match(/c[a-z0-9]{24}/)?.[0];
  expect(slug).toBeTruthy();

  const redirect = await page.request.get(
    `http://${workspaceHandle}.localhost:8080/${slug}?campaign=ignored`,
    { maxRedirects: 0 },
  );
  expect(redirect.status()).toBe(302);
  expect(redirect.headers()).toMatchObject({
    "cache-control": "no-store",
    location: "https://93.184.216.34/portfolio",
    "referrer-policy": "no-referrer",
  });

  let tenantCookieHeader: string | undefined;
  await page.route(
    (url) => url.hostname === `${workspaceHandle}.localhost`,
    async (route) => {
      tenantCookieHeader = (await route.request().headerValue("cookie")) ?? undefined;
      await route.fulfill({ body: "<title>Tenant</title>", contentType: "text/html", status: 200 });
    },
  );
  const tenantNavigation = await page.goto(
    `http://${workspaceHandle}.localhost:8080/${slug}?cookie-proof=1`,
  );
  expect(tenantNavigation?.status()).toBe(200);
  expect(tenantCookieHeader).toBeUndefined();

  const blockedRoute = await page.request.get(
    `http://${workspaceHandle}.localhost:8080/api/health`,
    { maxRedirects: 0 },
  );
  expect(blockedRoute.status()).toBe(404);
});
