import assert from "node:assert/strict";
import { Then, When } from "@cucumber/cucumber";

const baseUrl = process.env.BDD_BASE_URL ?? "http://app.localhost:8080";
let healthResponse: unknown;
let readinessResponse: unknown;

When("the health probe is requested", async () => {
  healthResponse = await fetch(`${baseUrl}/api/health`).then((response) => response.json());
  readinessResponse = await fetch(`${baseUrl}/api/ready`).then((response) => response.json());
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
