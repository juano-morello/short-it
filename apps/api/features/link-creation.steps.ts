import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Given, Then, When } from "@cucumber/cucumber";

const baseUrl = process.env.BDD_BASE_URL ?? "http://app.localhost:8080";

type WorkspaceOwner = {
  cookie: string;
  workspaceId: string;
};

let publishedLinkResponse: Response | undefined;
let workspaceOwner: WorkspaceOwner | undefined;

Given("a signed-in workspace owner", async () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const email = `link-owner-${suffix}@example.test`;
  const password = "correct-horse-battery-staple";

  const signUpResponse = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    body: JSON.stringify({ email, name: "Link Owner", password }),
    headers: { "content-type": "application/json", origin: baseUrl },
    method: "POST",
  });
  assert.equal(signUpResponse.status, 200);

  const signInResponse = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    body: JSON.stringify({ email, password }),
    headers: { "content-type": "application/json", origin: baseUrl },
    method: "POST",
  });
  assert.equal(signInResponse.status, 200);
  const cookie = signInResponse.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");
  assert.ok(cookie, "Expected sign-in to establish a session.");

  const workspaceResponse = await fetch(`${baseUrl}/api/auth/organization/create`, {
    body: JSON.stringify({
      keepCurrentActiveOrganization: true,
      name: "Link Workspace",
      slug: `links-${suffix}`,
    }),
    headers: requestHeaders(cookie),
    method: "POST",
  });
  assert.equal(workspaceResponse.status, 200);
  const workspace = (await workspaceResponse.json()) as { id: string };
  workspaceOwner = { cookie, workspaceId: workspace.id };
});

When("an unauthenticated visitor attempts to publish a link", async () => {
  publishedLinkResponse = await fetch(`${baseUrl}/api/links`, {
    body: JSON.stringify({
      destinationUrl: "https://93.184.216.34/portfolio",
      organizationId: "workspace-not-authorized",
    }),
    headers: { "content-type": "application/json", origin: baseUrl },
    method: "POST",
  });
});

When("the owner publishes a link to {string}", async (destinationUrl: string) => {
  assert.ok(workspaceOwner, "A signed-in workspace owner is required.");
  publishedLinkResponse = await fetch(`${baseUrl}/api/links`, {
    body: JSON.stringify({ destinationUrl, organizationId: workspaceOwner.workspaceId }),
    headers: requestHeaders(workspaceOwner.cookie),
    method: "POST",
  });
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
  assert.ok(workspaceOwner, "A signed-in workspace owner is required.");
  assert.equal(link.organizationId, workspaceOwner.workspaceId);
  assert.match(link.slug, /^c[a-z0-9]+$/);
  assert.notEqual(link.publishedAt, null);
});

Then("the link publication is rejected as unauthenticated", () => {
  assert.ok(publishedLinkResponse, "A link publication response is required.");
  assert.equal(publishedLinkResponse.status, 401);
});

Then("the link publication is rejected as cross-origin", () => {
  assert.ok(publishedLinkResponse, "A link publication response is required.");
  assert.equal(publishedLinkResponse.status, 403);
});

Then("the link publication is rejected with {string}", async (message: string) => {
  assert.ok(publishedLinkResponse, "A link publication response is required.");
  assert.equal(publishedLinkResponse.status, 400);
  const response = (await publishedLinkResponse.json()) as { message?: string };
  assert.equal(response.message, message);
});

function requestHeaders(cookie: string): Record<string, string> {
  return {
    "content-type": "application/json",
    cookie,
    origin: baseUrl,
  };
}
