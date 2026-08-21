import { HttpStatus } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { LinkPublicationRateLimiter } from "./publication-policy.js";

describe("LinkPublicationRateLimiter", () => {
  it("allows 30 publication attempts per member and workspace in ten minutes", () => {
    const limiter = new LinkPublicationRateLimiter(() => 0);

    for (let attempt = 0; attempt < 30; attempt += 1) {
      expect(() => limiter.take("member-1", "workspace-a")).not.toThrow();
    }

    expect(() => limiter.take("member-1", "workspace-a")).toThrowError(
      "Too many link publication attempts. Please try again later.",
    );
    expect(() => limiter.take("member-1", "workspace-a")).toThrow(
      expect.objectContaining({ status: HttpStatus.TOO_MANY_REQUESTS }),
    );
  });

  it("keeps member and workspace attempt budgets separate", () => {
    const limiter = new LinkPublicationRateLimiter(() => 0);

    for (let attempt = 0; attempt < 30; attempt += 1) {
      limiter.take("member-1", "workspace-a");
    }

    expect(() => limiter.take("member-2", "workspace-a")).not.toThrow();
    expect(() => limiter.take("member-1", "workspace-b")).not.toThrow();
  });

  it("restores the attempt budget after ten minutes", () => {
    let now = 0;
    const limiter = new LinkPublicationRateLimiter(() => now);

    for (let attempt = 0; attempt < 30; attempt += 1) {
      limiter.take("member-1", "workspace-a");
    }
    now = 10 * 60 * 1000;

    expect(() => limiter.take("member-1", "workspace-a")).not.toThrow();
  });
});
