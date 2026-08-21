import { afterEach, describe, expect, it } from "vitest";
import { getConfig } from "./config.js";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
});

describe("getConfig", () => {
  it("uses explicit local development defaults", () => {
    process.env = { NODE_ENV: "development" };
    expect(getConfig().baseUrl).toBe("http://app.localhost:8080");
  });

  it("fails closed when production auth configuration is incomplete", () => {
    process.env = { NODE_ENV: "production" };
    expect(getConfig).toThrow("BETTER_AUTH_URL");
  });
});
