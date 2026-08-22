import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Given, Then, When } from "@cucumber/cucumber";
import { prisma } from "../src/database.js";

const baseUrl = process.env.BDD_BASE_URL ?? "http://app.localhost:8080";
const dashboardOrigin = process.env.BDD_DASHBOARD_ORIGIN ?? baseUrl;
const dashboardHostHeader =
  dashboardOrigin === baseUrl ? {} : { host: new URL(dashboardOrigin).host };
const password = "correct-horse-battery-staple";

type WorkspaceMember = {
  cookie: string;
  workspaceId: string;
};

let publishedLinkResponse: Response | undefined;
let workspaceMember: WorkspaceMember | undefined;
let workspaceOwner: WorkspaceMember | undefined;
let separateWorkspaceId: string | undefined;

Given("a signed-in workspace owner", async () => {
  workspaceOwner = await createWorkspaceOwner();
  workspaceMember = workspaceOwner;
});

Given("a signed-in workspace editor", async () => {
  workspaceOwner = await createWorkspaceOwner();
  workspaceMember = await changeWorkspaceMemberRole("editor");
});

Given("a signed-in workspace analyst", async () => {
  workspaceOwner = await createWorkspaceOwner();
  workspaceMember = await changeWorkspaceMemberRole("analyst");
});

Given("a separate workspace exists", async () => {
  separateWorkspaceId = (await createWorkspaceOwner()).workspaceId;
});

When("an unauthenticated visitor attempts to publish a link", async () => {
  publishedLinkResponse = await publish({
    destinationUrl: "https://93.184.216.34/portfolio",
    organizationId: "workspace-not-authorized",
  });
});

When("the owner publishes a link to {string}", async (destinationUrl: string) => {
  assert.ok(workspaceOwner, "A signed-in workspace owner is required.");
  publishedLinkResponse = await publish(
    { destinationUrl, organizationId: workspaceOwner.workspaceId },
    workspaceOwner.cookie,
  );
});

When("the owner publishes a destination longer than 2,048 characters", async () => {
  assert.ok(workspaceOwner, "A signed-in workspace owner is required.");
  publishedLinkResponse = await publish(
    {
      destinationUrl: `https://93.184.216.34/${"a".repeat(2_048)}`,
      organizationId: workspaceOwner.workspaceId,
    },
    workspaceOwner.cookie,
  );
});

When("the owner makes 31 link publication attempts", async () => {
  assert.ok(workspaceOwner, "A signed-in workspace owner is required.");
  for (let attempt = 0; attempt < 31; attempt += 1) {
    publishedLinkResponse = await publish(
      {
        destinationUrl: "https://93.184.216.34/rate-limit",
        organizationId: workspaceOwner.workspaceId,
      },
      workspaceOwner.cookie,
    );
  }
});

When("the editor publishes a link to {string}", async (destinationUrl: string) => {
  assert.ok(workspaceMember, "A signed-in workspace editor is required.");
  publishedLinkResponse = await publish(
    { destinationUrl, organizationId: workspaceMember.workspaceId },
    workspaceMember.cookie,
  );
});

When("the analyst attempts to publish a link", async () => {
  assert.ok(workspaceMember, "A signed-in workspace analyst is required.");
  publishedLinkResponse = await publish(
    {
      destinationUrl: "https://93.184.216.34/analyst",
      organizationId: workspaceMember.workspaceId,
    },
    workspaceMember.cookie,
  );
});

When("the editor attempts to publish a link in the separate workspace", async () => {
  assert.ok(workspaceMember, "A signed-in workspace editor is required.");
  assert.ok(separateWorkspaceId, "A separate workspace is required.");
  publishedLinkResponse = await publish(
    {
      destinationUrl: "https://93.184.216.34/cross-workspace",
      organizationId: separateWorkspaceId,
    },
    workspaceMember.cookie,
  );
});

When("the owner attempts to publish a link from an untrusted origin", async () => {
  assert.ok(workspaceOwner, "A signed-in workspace owner is required.");
  publishedLinkResponse = await fetch(`${baseUrl}/api/links`, {
    body: JSON.stringify({
      destinationUrl: "https://93.184.216.34/portfolio",
      organizationId: workspaceOwner.workspaceId,
    }),
    headers: {
      "content-type": "application/json",
      cookie: workspaceOwner.cookie,
      origin: "https://untrusted.example",
    },
    method: "POST",
  });
});

Then("the published link belongs to that workspace and has a CUID slug", async () => {
  assert.ok(publishedLinkResponse, "A link publication response is required.");
  assert.equal(publishedLinkResponse.status, 201);
  const link = (await publishedLinkResponse.json()) as {
    organizationId: string;
    publishedAt: string | null;
    slug: string;
  };
  assert.ok(workspaceMember, "A signed-in workspace member is required.");
  assert.equal(link.organizationId, workspaceMember.workspaceId);
  assert.match(link.slug, /^c[a-z0-9]{24}$/);
  assert.notEqual(link.publishedAt, null);
});

Then("the link publication is rejected as unauthenticated", () => {
  assert.ok(publishedLinkResponse, "A link publication response is required.");
  assert.equal(publishedLinkResponse.status, 401);
});

Then("the link publication is rejected as forbidden", () => {
  assert.ok(publishedLinkResponse, "A link publication response is required.");
  assert.equal(publishedLinkResponse.status, 403);
});

Then("the link publication is rejected as cross-origin", () => {
  assert.ok(publishedLinkResponse, "A link publication response is required.");
  assert.equal(publishedLinkResponse.status, 403);
});

Then("the link publication is rejected as rate limited", async () => {
  assert.ok(publishedLinkResponse, "A link publication response is required.");
  assert.equal(publishedLinkResponse.status, 429);
  const response = (await publishedLinkResponse.json()) as { message?: string };
  assert.equal(response.message, "Too many link publication attempts. Please try again later.");
});

Then("the link publication is rejected with {string}", async (message: string) => {
  assert.ok(publishedLinkResponse, "A link publication response is required.");
  assert.equal(publishedLinkResponse.status, 400);
  const response = (await publishedLinkResponse.json()) as { message?: string };
  assert.equal(response.message, message);
});

async function createWorkspaceOwner(): Promise<WorkspaceMember> {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const email = `link-owner-${suffix}@example.test`;
  const owner = await createSignedInUser(email, "Link Owner");
  const workspaceResponse = await fetch(`${baseUrl}/api/workspaces`, {
    body: JSON.stringify({
      name: "Link Workspace",
      slug: `links-${suffix}`,
    }),
    headers: requestHeaders(owner.cookie),
    method: "POST",
  });
  assert.equal(workspaceResponse.status, 200);
  const workspace = (await workspaceResponse.json()) as { id: string };
  return { cookie: owner.cookie, workspaceId: workspace.id };
}

async function changeWorkspaceMemberRole(role: "analyst" | "editor"): Promise<WorkspaceMember> {
  assert.ok(workspaceOwner, "A signed-in workspace owner is required.");
  const session = await fetch(`${baseUrl}/api/auth/get-session`, {
    headers: requestHeaders(workspaceOwner.cookie),
  });
  assert.equal(session.status, 200);
  const body = (await session.json()) as { user?: { id?: string } };
  assert.ok(body.user?.id, "Expected the owner session to have a user ID.");
  await prisma.member.update({
    data: {
      role,
    },
    where: {
      organizationId_userId: {
        organizationId: workspaceOwner.workspaceId,
        userId: body.user.id,
      },
    },
  });
  return workspaceOwner;
}

async function createSignedInUser(
  email: string,
  name: string,
): Promise<{ cookie: string; userId: string }> {
  const signUpResponse = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    body: JSON.stringify({ email, name, password }),
    headers: {
      "content-type": "application/json",
      origin: dashboardOrigin,
      ...dashboardHostHeader,
    },
    method: "POST",
  });
  assert.equal(signUpResponse.status, 200);
  const signUp = (await signUpResponse.json()) as { user?: { id?: string } };
  assert.ok(signUp.user?.id, "Expected sign-up to return a user ID.");
  const signInResponse = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    body: JSON.stringify({ email, password }),
    headers: {
      "content-type": "application/json",
      origin: dashboardOrigin,
      ...dashboardHostHeader,
    },
    method: "POST",
  });
  assert.equal(signInResponse.status, 200);
  const cookie = signInResponse.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");
  assert.ok(cookie, "Expected sign-in to establish a session.");
  return { cookie, userId: signUp.user.id };
}

function publish(
  body: { destinationUrl: string; organizationId: string },
  cookie?: string,
): Promise<Response> {
  return fetch(`${baseUrl}/api/links`, {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
      origin: dashboardOrigin,
      ...dashboardHostHeader,
    },
    method: "POST",
  });
}

function requestHeaders(cookie: string): Record<string, string> {
  return {
    "content-type": "application/json",
    cookie,
    origin: dashboardOrigin,
    ...dashboardHostHeader,
  };
}
