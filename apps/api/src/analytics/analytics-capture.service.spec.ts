import { Logger } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AnalyticsCaptureService } from "./analytics-capture.service.js";

describe("AnalyticsCaptureService", () => {
  it("drops excess writes at its independent 20-capture limit without delaying redirects", async () => {
    const releases: Array<() => void> = [];
    const database = {
      $transaction: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            releases.push(resolve);
          }),
      ),
    };
    const capture = AnalyticsCaptureService.forTesting({
      database: database as never,
      now: () => new Date("2026-08-22T10:00:00.000Z"),
      visitorSecret: "analytics-secret-for-unit-tests-only",
    });
    const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);

    for (let index = 0; index < 20; index += 1) {
      expect(
        capture.tryCapture({
          ipAddress: "203.0.113.40",
          linkId: "link-1",
          organizationId: "workspace-1",
          referrer: undefined,
          requestId: `request-${index}`,
          userAgent: undefined,
        }),
      ).toBe(true);
    }
    expect(
      capture.tryCapture({
        ipAddress: "203.0.113.40",
        linkId: "link-1",
        organizationId: "workspace-1",
        referrer: undefined,
        requestId: "dropped-request",
        userAgent: undefined,
      }),
    ).toBe(false);
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(
        /"durationMs":\d+.*"event":"redirect_analytics".*"outcome":"dropped_capacity".*"requestId":"dropped-request".*"status":302/,
      ),
    );

    await vi.waitFor(() => expect(database.$transaction).toHaveBeenCalledTimes(20));
    releases.forEach((release) => {
      release();
    });
    log.mockRestore();
  });

  it("contains persistence failures after admitting a redirect capture", async () => {
    const capture = AnalyticsCaptureService.forTesting({
      database: {
        $transaction: vi.fn(async () => Promise.reject(new Error("database unavailable"))),
      } as never,
      now: () => new Date("2026-08-22T10:00:00.000Z"),
      visitorSecret: "analytics-secret-for-unit-tests-only",
    });
    const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);

    expect(
      capture.tryCapture({
        ipAddress: "203.0.113.40",
        linkId: "link-1",
        organizationId: "workspace-1",
        referrer: "https://source.example/private",
        requestId: "failed-capture-request",
        userAgent: "Private Browser Identifier",
      }),
    ).toBe(true);

    await vi.waitFor(() =>
      expect(log).toHaveBeenCalledWith(
        expect.stringMatching(
          /"durationMs":\d+.*"event":"redirect_analytics".*"outcome":"failed".*"requestId":"failed-capture-request".*"status":302/,
        ),
      ),
    );
    log.mockRestore();
  });
});
