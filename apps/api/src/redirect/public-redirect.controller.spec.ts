import { ServiceUnavailableException } from "@nestjs/common";
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { PublicRedirectController } from "./public-redirect.controller.js";

describe("PublicRedirectController", () => {
  it("writes a bodyless uncached redirect without using request query parameters", async () => {
    const service = { resolve: vi.fn(async () => "https://public.example/portfolio") };
    const response = createResponse();
    const controller = new PublicRedirectController(service as never);

    await controller.get(
      "cmf4fvwfl0000q47d6kh4wq9p",
      {
        headers: { host: "studio.short.it" },
        query: { campaign: "ignored" },
      } as unknown as Request,
      response as unknown as Response,
    );

    expect(service.resolve).toHaveBeenCalledWith({
      host: "studio.short.it",
      slug: "cmf4fvwfl0000q47d6kh4wq9p",
    });
    expect(response.status).toHaveBeenCalledWith(302);
    expect(response.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(response.setHeader).toHaveBeenCalledWith("Location", "https://public.example/portfolio");
    expect(response.setHeader).toHaveBeenCalledWith("Referrer-Policy", "no-referrer");
    expect(response.end).toHaveBeenCalledWith();
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
        { headers: { host: "studio.short.it" } } as Request,
        response as unknown as Response,
      ),
    ).rejects.toEqual(unavailable);
    expect(response.setHeader).toHaveBeenCalledWith("Retry-After", "2");
    expect(response.setHeader).not.toHaveBeenCalledWith("Location", expect.anything());
    expect(response.end).not.toHaveBeenCalled();
  });
});

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
