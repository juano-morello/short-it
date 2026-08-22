import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Given, Then, When } from "@cucumber/cucumber";
import { prisma } from "../src/database.js";

const baseUrl = process.env.BDD_BASE_URL ?? "http://app.localhost:8080";
const dashboardOrigin = process.env.BDD_DASHBOARD_ORIGIN ?? baseUrl;
const dashboardHostHeader =
  dashboardOrigin === baseUrl ? {} : { host: new URL(dashboardOrigin).host };
const password = "correct-horse-battery-staple";

let analyticsWorkspace: { cookie: string; id: string; linkId: string } | undefined;
let analyticsOverviewResponse: Response | undefined;

Given("a signed-in analyst has workspace analytics", async () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const email = `analytics-${suffix}@example.test`;
  const signUpResponse = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    body: JSON.stringify({ email, name: "Analytics Analyst", password }),
    headers: {
      "content-type": "application/json",
      origin: dashboardOrigin,
      ...dashboardHostHeader,
    },
    method: "POST",
  });
  assert.equal(signUpResponse.status, 200);
  const signUp = (await signUpResponse.json()) as { user?: { id?: string } };
  assert.ok(signUp.user?.id, "Expected an analytics user ID.");
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
  const workspaceResponse = await fetch(`${baseUrl}/api/auth/organization/create`, {
    body: JSON.stringify({
      keepCurrentActiveOrganization: true,
      name: "Analytics Workspace",
      slug: `analytics-${suffix}`,
    }),
    headers: {
      "content-type": "application/json",
      cookie,
      origin: dashboardOrigin,
      ...dashboardHostHeader,
    },
    method: "POST",
  });
  assert.equal(workspaceResponse.status, 200);
  const workspace = (await workspaceResponse.json()) as { id: string };
  await prisma.member.update({
    data: { role: "analyst" },
    where: { organizationId_userId: { organizationId: workspace.id, userId: signUp.user.id } },
  });
  const link = await prisma.link.create({
    data: {
      destinationUrl: "https://public.example/analytics",
      organizationId: workspace.id,
      publishedAt: new Date(),
    },
  });
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  await prisma.linkAnalyticsDaily.create({
    data: { clicks: 3, day, linkId: link.id, organizationId: workspace.id, uniqueVisitors: 2 },
  });
  await prisma.linkAnalyticsDimensionDaily.createMany({
    data: [
      {
        clicks: 3,
        day,
        dimension: "COUNTRY",
        linkId: link.id,
        organizationId: workspace.id,
        value: "Unknown",
      },
      {
        clicks: 3,
        day,
        dimension: "DEVICE",
        linkId: link.id,
        organizationId: workspace.id,
        value: "desktop",
      },
      {
        clicks: 3,
        day,
        dimension: "REFERRER",
        linkId: link.id,
        organizationId: workspace.id,
        value: "direct",
      },
    ],
  });
  analyticsWorkspace = { cookie, id: workspace.id, linkId: link.id };
});

When("the analyst requests the workspace analytics overview", async () => {
  assert.ok(analyticsWorkspace, "An analytics workspace is required.");
  analyticsOverviewResponse = await fetch(
    `${baseUrl}/api/organizations/${analyticsWorkspace.id}/analytics`,
    { headers: { cookie: analyticsWorkspace.cookie, ...dashboardHostHeader } },
  );
});

Then("the analyst receives only aggregate analytics for that workspace", async () => {
  assert.ok(analyticsWorkspace, "An analytics workspace is required.");
  assert.ok(analyticsOverviewResponse, "An analytics overview response is required.");
  assert.equal(analyticsOverviewResponse.status, 200);
  const body = (await analyticsOverviewResponse.json()) as {
    breakdowns: { countries: Array<{ clicks: number; value: string }> };
    daily: Array<{ clicks: number; dailyUniqueLinkVisitors: number; date: string }>;
  };
  assert.deepEqual(body.daily, [
    { clicks: 3, dailyUniqueLinkVisitors: 2, date: new Date().toISOString().slice(0, 10) },
  ]);
  assert.deepEqual(body.breakdowns.countries, [{ clicks: 3, value: "Unknown" }]);
  assert.equal(JSON.stringify(body).includes(analyticsWorkspace.linkId), false);

  const otherWorkspaceId = `other-analytics-${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  await prisma.organization.create({
    data: {
      id: otherWorkspaceId,
      name: "Other Analytics Workspace",
      slug: `other-analytics-${randomUUID().replaceAll("-", "").slice(0, 12)}`,
    },
  });
  const otherWorkspaceResponse = await fetch(
    `${baseUrl}/api/organizations/${otherWorkspaceId}/analytics`,
    { headers: { cookie: analyticsWorkspace.cookie, ...dashboardHostHeader } },
  );
  assert.equal(otherWorkspaceResponse.status, 403);
});
