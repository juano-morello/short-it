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

  it("uses a separate local analytics secret and requires one in production", () => {
    process.env = { NODE_ENV: "development" };
    expect(getConfig().analyticsVisitorSecret).toBe("local-analytics-visitor-secret");

    process.env = {
      ANALYTICS_VISITOR_SECRET: "a".repeat(32),
      APP_BASE_DOMAIN: "short.it",
      BETTER_AUTH_SECRET: "b".repeat(32),
      BETTER_AUTH_URL: "https://app.short.it",
      NODE_ENV: "production",
      TRUSTED_ORIGINS: "https://app.short.it",
      DATABASE_URL: "postgresql://example.test/shortit",
    };
    expect(getConfig().analyticsVisitorSecret).toBe("a".repeat(32));

    delete process.env.ANALYTICS_VISITOR_SECRET;
    expect(getConfig).toThrow("ANALYTICS_VISITOR_SECRET");

    process.env.ANALYTICS_VISITOR_SECRET = "b".repeat(32);
    expect(getConfig).toThrow("must differ");
  });
});
