import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";

test("an owner deletes a workspace after confirming its handle", async ({ page }) => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const handle = `delete${suffix}`;
  const email = `owner-${suffix}@example.test`;

  await createWorkspace(page, email, "Deletion Owner", handle);
  await page.getByRole("link", { exact: true, name: "Settings" }).click();

  await page.getByLabel("Confirm workspace handle").fill("wrong");
  await page.getByRole("button", { name: "Delete workspace permanently" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Enter the exact workspace handle to delete this workspace.",
  );

  await page.getByLabel("Confirm workspace handle").fill(handle);
  await page.getByRole("button", { name: "Delete workspace permanently" }).click();

  await expect(page.getByRole("heading", { name: "Create your workspace" })).toBeVisible();
  await page.getByLabel("Confirm account email").fill(email);
  await page.getByRole("button", { name: "Delete account permanently" }).click();
  await expect(page.getByRole("button", { name: "Create a workspace" })).toBeVisible();
});

test("a non-owner deletes their account after confirming their email", async ({
  browser,
  page,
}) => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const recipientEmail = `delete-member-${suffix}@example.test`;
  const recipientContext = await browser.newContext();
  const recipientPage = await recipientContext.newPage();

  try {
    await createSignedInAccount(recipientPage, recipientEmail, "Deletion Member");

    const ownerEmail = `delete-owner-${suffix}@example.test`;
    await createWorkspace(page, ownerEmail, "Deletion Owner", `account${suffix}`);
    await page.getByRole("link", { exact: true, name: "Settings" }).click();
    await page.getByLabel("Invitation email").fill(recipientEmail);
    await page.getByRole("button", { name: "Create invitation" }).click();
    const invitationLink = await page.getByLabel("Invitation link").inputValue();

    await recipientPage.goto(invitationLink);
    await recipientPage.getByRole("button", { name: "Accept invitation" }).click();
    await expect(recipientPage.getByText("Editor", { exact: true })).toBeVisible();

    await recipientPage.getByRole("link", { exact: true, name: "Settings" }).click();
    await recipientPage.getByLabel("Confirm account email").fill(recipientEmail);
    await recipientPage.getByRole("button", { name: "Delete account permanently" }).click();

    await expect(recipientPage.getByRole("button", { name: "Create a workspace" })).toBeVisible();
  } finally {
    await recipientContext.close();
  }
});

async function createWorkspace(
  page: Page,
  email: string,
  name: string,
  handle: string,
): Promise<void> {
  await createSignedInAccount(page, email, name);
  await page.getByLabel("Workspace name").fill(`${name} Workspace`);
  await page.getByLabel("Workspace handle").fill(handle);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page.getByRole("heading", { name: `${name} Workspace` })).toBeVisible();
}

async function createSignedInAccount(page: Page, email: string, name: string): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Create a workspace" }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Continue to sign in" }).click();
  await page.getByRole("button", { exact: true, name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Create your workspace" })).toBeVisible();
}
