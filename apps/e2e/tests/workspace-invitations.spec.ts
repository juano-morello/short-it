import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("an owner grants an editor role through a copied invitation link", async ({
  browser,
  page,
}) => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const recipientEmail = `recipient-${suffix}@example.test`;
  const recipientContext = await browser.newContext();
  const recipientPage = await recipientContext.newPage();

  try {
    await recipientPage.goto("/");
    await recipientPage.getByRole("button", { name: "Create a workspace" }).click();
    await recipientPage.getByLabel("Your name").fill("Invitation Recipient");
    await recipientPage.getByLabel("Email").fill(recipientEmail);
    await recipientPage.getByLabel("Password").fill("correct-horse-battery-staple");
    await recipientPage.getByRole("button", { name: "Continue to sign in" }).click();
    await recipientPage.getByRole("button", { exact: true, name: "Sign in" }).click();
    await expect(
      recipientPage.getByRole("heading", { name: "Create your workspace" }),
    ).toBeVisible();

    await page.goto("/");
    await page.getByRole("button", { name: "Create a workspace" }).click();
    await page.getByLabel("Your name").fill("Invitation Owner");
    await page.getByLabel("Email").fill(`owner-${suffix}@example.test`);
    await page.getByLabel("Password").fill("correct-horse-battery-staple");
    await page.getByRole("button", { name: "Continue to sign in" }).click();
    await page.getByRole("button", { exact: true, name: "Sign in" }).click();
    await page.getByLabel("Workspace name").fill("Invitation Workspace");
    await page.getByLabel("Workspace handle").fill(`invites${suffix}`);
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page.getByRole("heading", { name: "Invitation Workspace" })).toBeVisible();

    await page.getByLabel("Invitation email").fill(recipientEmail);
    await page.getByRole("button", { name: "Create invitation" }).click();
    const invitationLink = await page.getByLabel("Invitation link").inputValue();
    await expect(page.getByLabel("Invitation link")).toHaveAttribute("readonly");

    await recipientPage.goto(invitationLink);
    await expect(
      recipientPage.getByRole("heading", { name: "Join this workspace?" }),
    ).toBeVisible();
    const acceptance = recipientPage.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/auth/organization/accept-invitation"),
    );
    await recipientPage.getByRole("button", { name: "Accept invitation" }).click();
    expect((await acceptance).status()).toBe(200);
    await expect(
      recipientPage.getByRole("heading", { name: "Invitation Workspace" }),
    ).toBeVisible();
    await expect(recipientPage.getByText("Editor", { exact: true })).toBeVisible();
    expect(new URL(recipientPage.url()).hash).toBe("");
  } finally {
    await recipientContext.close();
  }
});
