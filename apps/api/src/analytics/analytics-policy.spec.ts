import { describe, expect, it } from "vitest";
import {
  classifyDevice,
  createDailyVisitorDigest,
  getAnalyticsDay,
  getVisitorExpiry,
  normalizeReferrerHost,
  normalizeTrustedIp,
} from "./analytics-policy.js";

describe("redirect analytics policy", () => {
  it("uses UTC calendar days for aggregation and visitor deduplication", () => {
    expect(getAnalyticsDay(new Date("2026-08-22T23:59:59.999Z"))).toEqual(
      new Date("2026-08-22T00:00:00.000Z"),
    );
  });

  it("derives a daily keyed visitor digest without retaining the source IP", () => {
    const first = createDailyVisitorDigest({
      day: new Date("2026-08-22T00:00:00.000Z"),
      ipAddress: "203.0.113.40",
      linkId: "link-a",
      organizationId: "workspace-a",
      secret: "analytics-secret-for-tests-only",
    });
    const nextDay = createDailyVisitorDigest({
      day: new Date("2026-08-23T00:00:00.000Z"),
      ipAddress: "203.0.113.40",
      linkId: "link-a",
      organizationId: "workspace-a",
      secret: "analytics-secret-for-tests-only",
    });

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain("203.0.113.40");
    expect(first).not.toBe(nextDay);
  });

  it("scopes visitor digests to one workspace link and expires them at the next UTC midnight", () => {
    const input = {
      day: new Date("2026-08-22T00:00:00.000Z"),
      ipAddress: "203.0.113.40",
      linkId: "link-a",
      organizationId: "workspace-a",
      secret: "analytics-secret-for-tests-only",
    };
    expect(createDailyVisitorDigest(input)).not.toBe(
      createDailyVisitorDigest({ ...input, linkId: "link-b" }),
    );
    expect(getVisitorExpiry(input.day)).toEqual(new Date("2026-08-23T00:00:00.000Z"));
  });

  it.each([
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", "mobile"],
    ["Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)", "tablet"],
    ["Mozilla/5.0 (X11; Linux x86_64)", "desktop"],
    ["Googlebot/2.1", "bot"],
    [undefined, "unknown"],
  ])("classifies a user agent as %s", (userAgent, category) => {
    expect(classifyDevice(userAgent)).toBe(category);
  });

  it("retains only a safe HTTP referrer host", () => {
    expect(normalizeReferrerHost("https://source.example/path?campaign=private")).toBe(
      "source.example",
    );
    expect(normalizeReferrerHost("mailto:private@example.test")).toBe("unknown");
    expect(normalizeReferrerHost("https://127.0.0.1/private")).toBe("unknown");
    expect(normalizeReferrerHost("https://internal.local/private")).toBe("unknown");
    expect(normalizeReferrerHost("https://preview.localhost/private")).toBe("unknown");
    expect(normalizeReferrerHost(undefined)).toBe("direct");
  });

  it("accepts only a syntactically valid edge-normalized IP", () => {
    expect(normalizeTrustedIp("203.0.113.40")).toBe("203.0.113.40");
    expect(normalizeTrustedIp("2001:db8::1")).toBe("2001:db8::1");
    expect(normalizeTrustedIp("203.0.113.40, attacker")).toBeUndefined();
    expect(normalizeTrustedIp(undefined)).toBeUndefined();
  });
});
