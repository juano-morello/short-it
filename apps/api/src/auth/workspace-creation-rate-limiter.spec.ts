import { HttpException, HttpStatus } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { WorkspaceCreationRateLimiter } from "./workspace-creation-rate-limiter.js";

describe("WorkspaceCreationRateLimiter", () => {
  it("allows 100 authenticated workspace-create requests per minute", () => {
    const limiter = new WorkspaceCreationRateLimiter(() => 0);

    for (let attempt = 0; attempt < 100; attempt += 1) {
      expect(() => limiter.take("user-1")).not.toThrow();
    }

    expect(() => limiter.take("user-1")).toThrow(
      new HttpException(
        "Too many workspace creation attempts. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );
  });

  it("restores the request budget after one minute", () => {
    let now = 0;
    const limiter = new WorkspaceCreationRateLimiter(() => now);

    for (let attempt = 0; attempt < 100; attempt += 1) limiter.take("user-1");
    now = 60_000;

    expect(() => limiter.take("user-1")).not.toThrow();
  });
});
