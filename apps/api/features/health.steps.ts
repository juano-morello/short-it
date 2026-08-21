import assert from "node:assert/strict";
import { Then, When } from "@cucumber/cucumber";

const baseUrl = process.env.BDD_BASE_URL ?? "http://app.localhost:8080";
const dashboardOrigin = process.env.BDD_DASHBOARD_ORIGIN ?? baseUrl;
const dashboardHostHeader =
  dashboardOrigin === baseUrl ? {} : { host: new URL(dashboardOrigin).host };
let healthResponse: unknown;
let readinessResponse: unknown;

When("the health probe is requested", async () => {
  healthResponse = await fetch(`${baseUrl}/api/health`, { headers: dashboardHostHeader }).then(
    (response) => response.json(),
  );
  readinessResponse = await fetch(`${baseUrl}/api/ready`, { headers: dashboardHostHeader }).then(
    (response) => response.json(),
  );
});

Then("it reports an operational short-it API process", () => {
  assert.deepEqual(healthResponse, {
    status: "ok",
    service: "short-it-api",
  });
});

Then("the readiness probe reports a ready database", () => {
  assert.deepEqual(readinessResponse, {
    status: "ok",
    service: "short-it-api",
    database: "ready",
  });
});
