import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";

test.describe("concurrent workspace onboarding", () => {
  test.describe.configure({ mode: "parallel" });

  for (const index of Array.from({ length: 7 }, (_, value) => value)) {
    test(`visitor ${index} creates an owner workspace`, async ({ page }) => {
      await createOwnerWorkspace(page, randomUUID().replaceAll("-", "").slice(0, 12), index);
      await expect(page.getByText("Owner", { exact: true })).toBeVisible();
    });
  }
});

async function createOwnerWorkspace(page: Page, suffix: string, index: number): Promise<void> {
  const email = `concurrent-${suffix}-${index}@example.test`;
  const workspaceName = `Concurrent Workspace ${index}`;
  const workspaceHandle = `concurrent-${suffix}-${index}`;

  await page.goto("/");
  await page.getByRole("button", { name: "Create a workspace" }).click();
  await page.getByLabel("Your name").fill(`Concurrent User ${index}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Continue to sign in" }).click();
  await page.getByRole("button", { exact: true, name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Create your workspace" })).toBeVisible();

  await page.getByLabel("Workspace name").fill(workspaceName);
  await page.getByLabel("Workspace handle").fill(workspaceHandle);
  await page.getByRole("button", { name: "Create workspace" }).click();

  await expect(page.getByRole("heading", { name: workspaceName })).toBeVisible();
}
