import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Given, Then, When } from "@cucumber/cucumber";
import { prisma } from "../src/database.js";

const baseUrl = process.env.BDD_BASE_URL ?? "http://app.localhost:8080";
const dashboardOrigin = process.env.BDD_DASHBOARD_ORIGIN ?? baseUrl;
const dashboardHostHeader =
  dashboardOrigin === baseUrl ? {} : { host: new URL(dashboardOrigin).host };
const password = "correct-horse-battery-staple";

type SignedInUser = { cookie: string; email: string; id: string };
type Workspace = { id: string; slug: string };

let accountDeletionResponse: Response | undefined;
let accountUser: SignedInUser | undefined;
let lifecycleWorkspace: Workspace | undefined;
let nativeWorkspaceCreationResponse: Response | undefined;
let otherWorkspace: Workspace | undefined;
let concurrentWorkspaceCreationResponse: Response | undefined;
let workspaceDeletionResponse: Response | undefined;

Given("a signed-in workspace owner with a published link", async () => {
  accountUser = await createSignedInUser("owner");
  lifecycleWorkspace = await createWorkspace(accountUser, "owner-workspace");
  const link = await prisma.link.create({
    data: {
      destinationUrl: "https://public.example/lifecycle",
      organizationId: lifecycleWorkspace.id,
      publishedAt: new Date(),
    },
  });
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  await prisma.linkAnalyticsDaily.create({
    data: {
      clicks: 1,
      day,
      linkId: link.id,
      organizationId: lifecycleWorkspace.id,
      uniqueVisitors: 1,
    },
  });
  await prisma.linkAnalyticsDimensionDaily.create({
    data: {
      clicks: 1,
      day,
      dimension: "COUNTRY",
      linkId: link.id,
      organizationId: lifecycleWorkspace.id,
      value: "AR",
    },
  });
  await prisma.linkAnalyticsVisitor.create({
    data: {
      day,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      linkId: link.id,
      organizationId: lifecycleWorkspace.id,
      visitorDigest: "a".repeat(64),
    },
  });
  await prisma.invitation.create({
    data: {
      email: `invite-${randomUUID()}@example.test`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      id: randomUUID().replaceAll("-", "").slice(0, 32),
      inviterId: accountUser.id,
      organizationId: lifecycleWorkspace.id,
      role: "editor",
      status: "pending",
    },
  });
  await prisma.member.create({
    data: {
      id: randomUUID(),
      organizationId: lifecycleWorkspace.id,
      role: "editor",
      userId: (await createSignedInUser("workspace-member")).id,
    },
  });
});

When("the owner deletes the workspace", async () => {
  assert.ok(accountUser, "A signed-in owner is required.");
  assert.ok(lifecycleWorkspace, "A workspace is required.");
  workspaceDeletionResponse = await fetch(`${baseUrl}/api/auth/organization/delete`, {
    body: JSON.stringify({ organizationId: lifecycleWorkspace.id }),
    headers: requestHeaders(accountUser),
    method: "POST",
  });
});

Then("the workspace and its scoped records no longer exist", async () => {
  assert.ok(lifecycleWorkspace, "A workspace is required.");
  assert.ok(workspaceDeletionResponse, "A workspace deletion response is required.");
  assert.equal(workspaceDeletionResponse.status, 200);
  await expectWorkspaceMissing(lifecycleWorkspace.id);
});

Given("a signed-in workspace editor and another workspace", async () => {
  await createNonOwnerFixture("editor");
});

Given("a signed-in workspace analyst and another workspace", async () => {
  await createNonOwnerFixture("analyst");
});

Given("a signed-in workspace owner and another workspace", async () => {
  accountUser = await createSignedInUser("owner");
  lifecycleWorkspace = await createWorkspace(accountUser, "owner-workspace");
  otherWorkspace = await createWorkspace(
    await createSignedInUser("other-owner"),
    "other-workspace",
  );
  await createLink(otherWorkspace.id);
});

async function createNonOwnerFixture(role: "analyst" | "editor"): Promise<void> {
  accountUser = await createSignedInUser(role);
  lifecycleWorkspace = await createWorkspace(accountUser, `${role}-workspace`);
  otherWorkspace = await createWorkspace(
    await createSignedInUser("other-owner"),
    "other-workspace",
  );
  await prisma.member.create({
    data: {
      id: randomUUID(),
      organizationId: otherWorkspace.id,
      role,
      userId: accountUser.id,
    },
  });
  await createLink(otherWorkspace.id);
}

When("the editor deletes the other workspace", async () => {
  await deleteOtherWorkspace();
});

When("the analyst deletes the other workspace", async () => {
  await deleteOtherWorkspace();
});

When("the owner deletes the other workspace", async () => {
  await deleteOtherWorkspace();
});

async function deleteOtherWorkspace(): Promise<void> {
  assert.ok(accountUser, "A signed-in user is required.");
  assert.ok(otherWorkspace, "Another workspace is required.");
  workspaceDeletionResponse = await fetch(`${baseUrl}/api/auth/organization/delete`, {
    body: JSON.stringify({ organizationId: otherWorkspace.id }),
    headers: requestHeaders(accountUser),
    method: "POST",
  });
}

Then("the workspace deletion is forbidden and the other workspace remains", async () => {
  assert.ok(otherWorkspace, "Another workspace is required.");
  assert.ok(workspaceDeletionResponse, "A workspace deletion response is required.");
  assert.ok(
    [400, 403].includes(workspaceDeletionResponse.status),
    `Expected a rejected workspace deletion, received ${workspaceDeletionResponse.status}.`,
  );
  await expectWorkspacePresent(otherWorkspace.id);
});

Given("a signed-in account owner with a workspace", async () => {
  accountUser = await createSignedInUser("account-owner");
  lifecycleWorkspace = await createWorkspace(accountUser, "account-owner");
});

When("the account owner requests account deletion with their email confirmation", async () => {
  assert.ok(accountUser, "A signed-in account owner is required.");
  accountDeletionResponse = await requestAccountDeletion(accountUser);
});

Then("account deletion is rejected and the account remains", async () => {
  assert.ok(accountDeletionResponse, "An account deletion response is required.");
  assert.ok(accountUser, "A signed-in account owner is required.");
  assert.equal(accountDeletionResponse.status, 409);
  assert.ok(await prisma.user.findUnique({ where: { id: accountUser.id } }));
});

Given("a signed-in user without an owned workspace", async () => {
  accountUser = await createSignedInUser("member");
  otherWorkspace = await createWorkspace(
    await createSignedInUser("workspace-owner"),
    "member-workspace",
  );
  await prisma.member.create({
    data: {
      id: randomUUID(),
      organizationId: otherWorkspace.id,
      role: "editor",
      userId: accountUser.id,
    },
  });
});

Given("a signed-in user without a workspace", async () => {
  accountUser = await createSignedInUser("workspace-race");
});

When("the user requests account deletion with their email confirmation", async () => {
  assert.ok(accountUser, "A signed-in user is required.");
  accountDeletionResponse = await requestAccountDeletion(accountUser);
});

Then("the account, credentials, session, and memberships no longer exist", async () => {
  assert.ok(accountDeletionResponse, "An account deletion response is required.");
  assert.ok(accountUser, "A signed-in user is required.");
  assert.equal(accountDeletionResponse.status, 204);
  assert.equal(await prisma.user.findUnique({ where: { id: accountUser.id } }), null);
  assert.equal(await prisma.account.count({ where: { userId: accountUser.id } }), 0);
  assert.equal(await prisma.session.count({ where: { userId: accountUser.id } }), 0);
  assert.equal(await prisma.member.count({ where: { userId: accountUser.id } }), 0);
  const subsequentRequest = await requestAccountDeletion(accountUser);
  assert.equal(subsequentRequest.status, 401);
});

When("the user concurrently creates a workspace and deletes their account", async () => {
  assert.ok(accountUser, "A signed-in user is required.");
  const slug = `race-${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  [concurrentWorkspaceCreationResponse, accountDeletionResponse] = await Promise.all([
    fetch(`${baseUrl}/api/workspaces`, {
      body: JSON.stringify({ name: "Concurrent Workspace", slug }),
      headers: requestHeaders(accountUser),
      method: "POST",
    }),
    requestAccountDeletion(accountUser),
  ]);
  lifecycleWorkspace = { id: slug, slug };
});

Then("exactly one lifecycle operation succeeds without an ownerless workspace", async () => {
  assert.ok(accountUser, "A signed-in user is required.");
  assert.ok(concurrentWorkspaceCreationResponse, "A workspace response is required.");
  assert.ok(accountDeletionResponse, "An account deletion response is required.");
  assert.ok(lifecycleWorkspace, "A workspace handle is required.");

  const workspaceCreated = concurrentWorkspaceCreationResponse.status === 200;
  const accountDeleted = accountDeletionResponse.status === 204;
  assert.notEqual(workspaceCreated, accountDeleted);

  const workspace = await prisma.organization.findUnique({
    where: { slug: lifecycleWorkspace.slug },
  });
  if (workspaceCreated) {
    assert.equal(accountDeletionResponse.status, 409);
    assert.ok(workspace);
    assert.equal(
      await prisma.member.count({
        where: {
          organizationId: workspace.id,
          role: { contains: "owner" },
          userId: accountUser.id,
        },
      }),
      1,
    );
  } else {
    assert.equal(concurrentWorkspaceCreationResponse.status, 401);
    assert.equal(workspace, null);
    assert.equal(await prisma.user.findUnique({ where: { id: accountUser.id } }), null);
  }
});

When("the user calls the native workspace creation route", async () => {
  assert.ok(accountUser, "A signed-in user is required.");
  nativeWorkspaceCreationResponse = await fetch(`${baseUrl}/api/auth/organization/create`, {
    body: JSON.stringify({ name: "Blocked Workspace", slug: "blocked-workspace" }),
    headers: requestHeaders(accountUser),
    method: "POST",
  });
});

Then("native workspace creation is rejected", async () => {
  assert.ok(nativeWorkspaceCreationResponse, "A native workspace response is required.");
  assert.equal(nativeWorkspaceCreationResponse.status, 404);
});

async function createSignedInUser(prefix: string): Promise<SignedInUser> {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const email = `${prefix}-${suffix}@example.test`;
  const signUpResponse = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    body: JSON.stringify({ email, name: "Lifecycle User", password }),
    headers: jsonHeaders(),
    method: "POST",
  });
  assert.equal(signUpResponse.status, 200);
  const signUp = (await signUpResponse.json()) as { user?: { id?: string } };
  assert.ok(signUp.user?.id, "Expected a user ID.");

  const signInResponse = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    body: JSON.stringify({ email, password }),
    headers: jsonHeaders(),
    method: "POST",
  });
  assert.equal(signInResponse.status, 200);
  return {
    cookie: signInResponse.headers
      .getSetCookie()
      .map((value) => value.split(";", 1)[0])
      .join("; "),
    email,
    id: signUp.user.id,
  };
}

async function createWorkspace(user: SignedInUser, prefix: string): Promise<Workspace> {
  const slug = `${prefix}-${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const response = await fetch(`${baseUrl}/api/workspaces`, {
    body: JSON.stringify({
      name: "Lifecycle Workspace",
      slug,
    }),
    headers: requestHeaders(user),
    method: "POST",
  });
  assert.equal(response.status, 200);
  const workspace = (await response.json()) as Workspace;
  return workspace;
}

async function expectWorkspaceMissing(organizationId: string): Promise<void> {
  assert.equal(await prisma.organization.findUnique({ where: { id: organizationId } }), null);
  assert.equal(await prisma.link.count({ where: { organizationId } }), 0);
  assert.equal(await prisma.invitation.count({ where: { organizationId } }), 0);
  assert.equal(await prisma.member.count({ where: { organizationId } }), 0);
  assert.equal(await prisma.linkAnalyticsDaily.count({ where: { organizationId } }), 0);
  assert.equal(await prisma.linkAnalyticsDimensionDaily.count({ where: { organizationId } }), 0);
  assert.equal(await prisma.linkAnalyticsVisitor.count({ where: { organizationId } }), 0);
}

async function expectWorkspacePresent(organizationId: string): Promise<void> {
  assert.ok(await prisma.organization.findUnique({ where: { id: organizationId } }));
  assert.equal(await prisma.link.count({ where: { organizationId } }), 1);
}

async function createLink(organizationId: string): Promise<void> {
  await prisma.link.create({
    data: { destinationUrl: "https://public.example/other-workspace", organizationId },
  });
}

function jsonHeaders(): HeadersInit {
  return { "content-type": "application/json", origin: dashboardOrigin, ...dashboardHostHeader };
}

function requestAccountDeletion(user: SignedInUser): Promise<Response> {
  return fetch(`${baseUrl}/api/account`, {
    body: JSON.stringify({ confirmationEmail: user.email }),
    headers: requestHeaders(user),
    method: "DELETE",
  });
}

function requestHeaders(user: SignedInUser): HeadersInit {
  return { ...jsonHeaders(), cookie: user.cookie };
}
