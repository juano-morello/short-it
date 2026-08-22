import assert from "node:assert/strict";
import { Then, When } from "@cucumber/cucumber";

const baseUrl = process.env.BDD_BASE_URL ?? "http://app.localhost:8080";
const dashboardOrigin = process.env.BDD_DASHBOARD_ORIGIN ?? baseUrl;
const dashboardHostHeader =
  dashboardOrigin === baseUrl ? {} : { host: new URL(dashboardOrigin).host };
let healthResponse: unknown;
let healthStatus: number;
let readinessResponse: unknown;
let readinessStatus: number;

When("the health probe is requested", async () => {
  const health = await fetch(`${baseUrl}/api/health`, { headers: dashboardHostHeader });
  healthStatus = health.status;
  healthResponse = await health.json();

  const readiness = await fetch(`${baseUrl}/api/ready`, { headers: dashboardHostHeader });
  readinessStatus = readiness.status;
  readinessResponse = await readiness.json();
});

Then("it reports an operational short-it API process", () => {
  assert.equal(healthStatus, 200);
  assert.deepEqual(healthResponse, {
    status: "ok",
    service: "short-it-api",
  });
});

Then("the readiness probe reports a ready database", () => {
  assert.equal(readinessStatus, 200);
  assert.deepEqual(readinessResponse, {
    status: "ok",
    service: "short-it-api",
    database: "ready",
  });
});
