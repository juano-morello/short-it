import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { request } from "node:http";
import { After, Given, Then, When } from "@cucumber/cucumber";
import { prisma } from "../src/database.js";

const edgeUrl = process.env.BDD_EDGE_URL ?? "http://edge:8080";

let publicLink:
  | {
      destinationUrl: string;
      id: string;
      organizationId: string;
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
let analyticsLock: Promise<unknown> | undefined;
let releaseAnalyticsLock: (() => void) | undefined;

Given("a public workspace has a published link", async () => {
  publicLink = await createPublicLink(true);
});

Given("a public workspace has an unpublished link", async () => {
  publicLink = await createPublicLink(false);
});

Given("analytics capture fails for that link", async () => {
  let acquired: (() => void) | undefined;
  const lockAcquired = new Promise<void>((resolve) => {
    acquired = resolve;
  });
  const lockReleased = new Promise<void>((resolve) => {
    releaseAnalyticsLock = resolve;
  });
  analyticsLock = prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe('LOCK TABLE "LinkAnalyticsDaily" IN ACCESS EXCLUSIVE MODE');
    acquired?.();
    await lockReleased;
  });
  await lockAcquired;
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
  return {
    destinationUrl,
    id: link.id,
    organizationId: organization.id,
    slug: link.slug,
    workspaceHandle,
  };
}

When("a visitor follows the published link from that workspace host", async () => {
  assert.ok(publicLink, "A published public link is required.");
  redirectResponse = await requestPublicRedirect(
    `${publicLink.workspaceHandle}.localhost`,
    `/${publicLink.slug}?source=ignored`,
    "GET",
    {
      referer: "https://source.example/path?private-referrer-marker",
      "user-agent": "private-visitor-identifier",
      "x-shortit-client-ip": "198.51.100.99",
    },
  );
  if (releaseAnalyticsLock) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    releaseAnalyticsLock();
    await analyticsLock;
    analyticsLock = undefined;
    releaseAnalyticsLock = undefined;
  }
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
  assert.equal(redirectResponse.headers.location, undefined);
});

Then("the redirect analytics contain one click with an Unknown country", async () => {
  assert.ok(publicLink, "A published public link is required.");
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  const daily = await waitForAnalytics(async () =>
    prisma.linkAnalyticsDaily.findUnique({
      where: {
        organizationId_linkId_day: {
          day,
          linkId: publicLink.id,
          organizationId: publicLink.organizationId,
        },
      },
    }),
  );
  assert.equal(daily?.clicks, 1);
  const country = await prisma.linkAnalyticsDimensionDaily.findUnique({
    where: {
      organizationId_linkId_day_dimension_value: {
        day,
        dimension: "COUNTRY",
        linkId: publicLink.id,
        organizationId: publicLink.organizationId,
        value: "Unknown",
      },
    },
  });
  assert.equal(country?.clicks, 1);
});

Then("redirect analytics do not retain raw visitor identifiers", async () => {
  assert.ok(publicLink, "A published public link is required.");
  const visitors = await prisma.linkAnalyticsVisitor.findMany({
    where: { linkId: publicLink.id, organizationId: publicLink.organizationId },
  });
  assert.equal(visitors.length, 1);
  const persisted = JSON.stringify(visitors);
  assert.equal(persisted.includes("private-visitor-identifier"), false);
  assert.equal(persisted.includes("private-referrer-marker"), false);
  assert.equal(persisted.includes("198.51.100.99"), false);
});

After(async () => {
  if (releaseAnalyticsLock) {
    releaseAnalyticsLock();
    await analyticsLock;
  }
  analyticsLock = undefined;
  releaseAnalyticsLock = undefined;
});

async function waitForAnalytics<T>(operation: () => Promise<T | null>): Promise<T | null> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const result = await operation();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
}

async function requestPublicRedirect(
  host: string,
  path: string,
  method = "GET",
  headers: Record<string, string> = {},
): Promise<{
  body: string;
  headers: Record<string, string | string[] | undefined>;
  status: number;
}> {
  const edge = new URL(edgeUrl);

  return new Promise((resolve, reject) => {
    const outgoing = request(
      {
        headers: { host, ...headers },
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
