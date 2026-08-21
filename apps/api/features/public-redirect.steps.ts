import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { request } from "node:http";
import { Given, Then, When } from "@cucumber/cucumber";
import { prisma } from "../src/database.js";

const edgeUrl = process.env.BDD_EDGE_URL ?? "http://edge:8080";

let publicLink:
  | {
      destinationUrl: string;
      slug: string;
      workspaceHandle: string;
    }
  | undefined;
let redirectResponse:
  | {
      body: string;
      headers: Record<string, string | string[] | undefined>;
      status: number;
    }
  | undefined;
let headResponse: typeof redirectResponse;
let otherWorkspaceHandle: string | undefined;

Given("a public workspace has a published link", async () => {
  publicLink = await createPublicLink(true);
});

Given("a public workspace has an unpublished link", async () => {
  publicLink = await createPublicLink(false);
});

Given("a separate public workspace exists", async () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  otherWorkspaceHandle = `other${suffix}`;
  await prisma.organization.create({
    data: {
      id: `other-redirect-workspace-${suffix}`,
      name: "Other Redirect Workspace",
      slug: otherWorkspaceHandle,
    },
  });
});

async function createPublicLink(published: boolean): Promise<NonNullable<typeof publicLink>> {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const workspaceHandle = `redirect${suffix}`;
  const destinationUrl = "https://93.184.216.34/portfolio";
  const organization = await prisma.organization.create({
    data: {
      id: `redirect-workspace-${suffix}`,
      name: "Redirect Workspace",
      slug: workspaceHandle,
    },
  });
  const link = await prisma.link.create({
    data: {
      destinationUrl,
      organizationId: organization.id,
      publishedAt: published ? new Date() : undefined,
    },
  });
  return { destinationUrl, slug: link.slug, workspaceHandle };
}

When("a visitor follows the published link from that workspace host", async () => {
  assert.ok(publicLink, "A published public link is required.");
  redirectResponse = await requestPublicRedirect(
    `${publicLink.workspaceHandle}.localhost`,
    `/${publicLink.slug}?source=ignored`,
  );
});

When("a visitor follows that link from a different workspace host", async () => {
  assert.ok(publicLink, "A public link is required.");
  assert.ok(otherWorkspaceHandle, "A separate public workspace is required.");
  redirectResponse = await requestPublicRedirect(
    `${otherWorkspaceHandle}.localhost`,
    `/${publicLink.slug}`,
  );
});

When("a visitor requests a tenant API route", async () => {
  assert.ok(publicLink, "A public link is required.");
  redirectResponse = await requestPublicRedirect(
    `${publicLink.workspaceHandle}.localhost`,
    "/api/health",
  );
});

Then("the visitor receives an uncached redirect to the published destination", () => {
  assert.ok(publicLink, "A published public link is required.");
  assert.ok(redirectResponse, "A redirect response is required.");
  assert.equal(redirectResponse.status, 302);
  assert.equal(redirectResponse.headers.location, publicLink.destinationUrl);
  assert.equal(redirectResponse.headers["cache-control"], "no-store");
  assert.equal(redirectResponse.headers["referrer-policy"], "no-referrer");
});

Then("a HEAD request receives the same redirect headers without a body", async () => {
  assert.ok(publicLink, "A published public link is required.");
  headResponse = await requestPublicRedirect(
    `${publicLink.workspaceHandle}.localhost`,
    `/${publicLink.slug}`,
    "HEAD",
  );

  assert.equal(headResponse.status, 302);
  assert.equal(headResponse.body, "");
  assert.equal(headResponse.headers.location, publicLink.destinationUrl);
  assert.equal(headResponse.headers["cache-control"], "no-store");
  assert.equal(headResponse.headers["referrer-policy"], "no-referrer");
});

Then("the visitor receives a generic not found response", () => {
  assert.ok(redirectResponse, "A response is required.");
  assert.equal(redirectResponse.status, 404);
});

async function requestPublicRedirect(
  host: string,
  path: string,
  method = "GET",
): Promise<{
  body: string;
  headers: Record<string, string | string[] | undefined>;
  status: number;
}> {
  const edge = new URL(edgeUrl);

  return new Promise((resolve, reject) => {
    const outgoing = request(
      {
        headers: { host },
        hostname: edge.hostname,
        method,
        path,
        port: edge.port,
        protocol: edge.protocol,
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => {
          body += chunk;
        });
        response.on("end", () => {
          resolve({ body, headers: response.headers, status: response.statusCode ?? 500 });
        });
      },
    );
    outgoing.on("error", reject);
    outgoing.end();
  });
}
