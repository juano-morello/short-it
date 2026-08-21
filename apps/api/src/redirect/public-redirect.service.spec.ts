import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { PublicRedirectService } from "./public-redirect.service.js";

const slug = "cmf4fvwfl0000q47d6kh4wq9p";

describe("PublicRedirectService", () => {
  it("looks up a published link through the public workspace host and revalidates its destination", async () => {
    const database = createDatabase({
      destinationUrl: "https://public.example/portfolio",
      publishedAt: new Date(),
    });
    const validateDestination = vi.fn(async () => "https://public.example/portfolio");
    const service = PublicRedirectService.forTesting({
      baseDomain: "short.it",
      database: database as never,
      validateDestination,
    });

    await expect(
      service.resolve({ host: "studio.short.it", requestId: "redirect-123", slug }),
    ).resolves.toBe("https://public.example/portfolio");
    expect(database.organization.findUnique).toHaveBeenCalledWith({
      select: { id: true },
      where: { slug: "studio" },
    });
    expect(database.link.findUnique).toHaveBeenCalledWith({
      select: { destinationUrl: true, publishedAt: true },
      where: { organizationId_slug: { organizationId: "workspace-1", slug } },
    });
    expect(validateDestination).toHaveBeenCalledWith(
      "https://public.example/portfolio",
      undefined,
      "redirect-123",
    );
  });

  it.each([
    [
      { host: "app.short.it", slug },
      { destinationUrl: "https://public.example", publishedAt: new Date() },
    ],
    [
      { host: "studio.short.it", slug: "vanity-slug" },
      { destinationUrl: "https://public.example", publishedAt: new Date() },
    ],
    [{ host: "studio.short.it", slug }, undefined],
    [
      { host: "studio.short.it", slug },
      { destinationUrl: "https://public.example", publishedAt: null },
    ],
  ])(
    "uses one generic not-found response when a public redirect cannot resolve",
    async (input, link) => {
      const database = createDatabase(link);
      const validateDestination = vi.fn(async () => "https://public.example/");
      const service = PublicRedirectService.forTesting({
        baseDomain: "short.it",
        database: database as never,
        validateDestination,
      });

      await expect(service.resolve(input)).rejects.toEqual(new NotFoundException());
    },
  );

  it("hides permanently unsafe destinations as not found while preserving transient retryability", async () => {
    const database = createDatabase({
      destinationUrl: "https://public.example",
      publishedAt: new Date(),
    });
    const service = PublicRedirectService.forTesting({
      baseDomain: "short.it",
      database: database as never,
      validateDestination: async () => {
        throw new BadRequestException("Link destinations must not resolve privately.");
      },
    });

    await expect(service.resolve({ host: "studio.short.it", slug })).rejects.toEqual(
      new NotFoundException(),
    );

    const unavailableService = PublicRedirectService.forTesting({
      baseDomain: "short.it",
      database: database as never,
      validateDestination: async () => {
        throw new ServiceUnavailableException("Destination validation is temporarily unavailable.");
      },
    });
    await expect(unavailableService.resolve({ host: "studio.short.it", slug })).rejects.toEqual(
      new ServiceUnavailableException("Destination validation is temporarily unavailable."),
    );
  });
});

function createDatabase(link: { destinationUrl: string; publishedAt: Date | null } | undefined) {
  return {
    link: { findUnique: vi.fn().mockResolvedValue(link) },
    organization: { findUnique: vi.fn().mockResolvedValue({ id: "workspace-1" }) },
  };
}
