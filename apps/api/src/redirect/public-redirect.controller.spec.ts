import { Logger, ServiceUnavailableException } from "@nestjs/common";
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { assertSafeRedirectDestinationUrl } from "../links/destination-policy.js";
import { PublicRedirectController } from "./public-redirect.controller.js";

describe("PublicRedirectController", () => {
  it("writes a bodyless uncached redirect without using request query parameters", async () => {
    const service = { resolve: vi.fn(async () => "https://public.example/portfolio") };
    const response = createResponse();
    const controller = new PublicRedirectController(service as never);
    const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);

    await controller.get(
      "cmf4fvwfl0000q47d6kh4wq9p",
      {
        headers: { host: "studio.short.it", "x-request-id": "redirect-123" },
        get: (name: string) => (name === "x-request-id" ? "redirect-123" : undefined),
        query: { campaign: "ignored" },
      } as unknown as Request,
      response as unknown as Response,
    );

    expect(service.resolve).toHaveBeenCalledWith({
      host: "studio.short.it",
      requestId: "redirect-123",
      slug: "cmf4fvwfl0000q47d6kh4wq9p",
    });
    expect(response.status).toHaveBeenCalledWith(302);
    expect(response.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(response.setHeader).toHaveBeenCalledWith("Location", "https://public.example/portfolio");
    expect(response.setHeader).toHaveBeenCalledWith("Referrer-Policy", "no-referrer");
    expect(response.end).toHaveBeenCalledWith();
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/"event":"public_redirect".*"outcome":"redirected".*"status":302/),
    );
    log.mockRestore();
  });

  it("adds a retry hint without a location when redirect-time validation is unavailable", async () => {
    const unavailable = new ServiceUnavailableException(
      "Destination validation is temporarily unavailable.",
    );
    const service = { resolve: vi.fn(async () => Promise.reject(unavailable)) };
    const response = createResponse();
    const controller = new PublicRedirectController(service as never);

    await expect(
      controller.get(
        "cmf4fvwfl0000q47d6kh4wq9p",
        { get: () => undefined, headers: { host: "studio.short.it" } } as unknown as Request,
        response as unknown as Response,
      ),
    ).rejects.toEqual(unavailable);
    expect(response.setHeader).toHaveBeenCalledWith("Retry-After", "2");
    expect(response.setHeader).not.toHaveBeenCalledWith("Location", expect.anything());
    expect(response.end).not.toHaveBeenCalled();
  });

  it("returns retryable headers without a location when the redirect DNS pool is saturated", async () => {
    const settleResolutions: Array<(addresses: Array<{ address: string }>) => void> = [];
    const service = {
      resolve: async ({ slug }: { slug: string }) =>
        assertSafeRedirectDestinationUrl(
          `https://${slug}.example`,
          async () =>
            new Promise<Array<{ address: string }>>((resolve) => {
              settleResolutions.push(resolve);
            }),
        ),
    };
    const controller = new PublicRedirectController(service as never);
    const pendingRedirects = Array.from({ length: 10 }, (_, index) =>
      controller.get(
        cuidFor(index),
        requestForController(),
        createResponse() as unknown as Response,
      ),
    );
    const response = createResponse();

    await expect(
      controller.get(cuidFor(10), requestForController(), response as unknown as Response),
    ).rejects.toEqual(
      new ServiceUnavailableException("Destination validation is temporarily unavailable."),
    );
    expect(response.setHeader).toHaveBeenCalledWith("Retry-After", "2");
    expect(response.setHeader).not.toHaveBeenCalledWith("Location", expect.anything());

    await Promise.resolve();
    await Promise.resolve();
    for (const settle of settleResolutions) {
      settle([{ address: "93.184.216.34" }]);
    }
    await Promise.all(pendingRedirects);
  });
});

function cuidFor(index: number): string {
  return `c${index.toString().padStart(24, "0")}`;
}

function requestForController(): Request {
  return { get: () => undefined, headers: { host: "studio.short.it" } } as unknown as Request;
}

function createResponse() {
  const response = {
    end: vi.fn(),
    setHeader: vi.fn(),
    status: vi.fn(),
  };
  response.status.mockReturnValue(response);
  response.setHeader.mockReturnValue(response);
  return response;
}
