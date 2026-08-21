import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../auth/auth.js", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

import { auth } from "../auth/auth.js";
import { LinksController } from "./links.controller.js";

describe("LinksController", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const linksService = { create: vi.fn() };

  beforeEach(() => {
    process.env.NODE_ENV = "development";
    vi.clearAllMocks();
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("passes the session user and browser-selected workspace to the link service", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "member-1" } } as never);
    linksService.create.mockResolvedValue({ slug: "cmfoo123" });

    await expect(
      new LinksController(linksService as never).create(
        {
          destinationUrl: "https://example.com/portfolio",
          organizationId: "workspace-1",
        },
        requestFrom("http://app.localhost:8080"),
      ),
    ).resolves.toEqual({ slug: "cmfoo123" });

    expect(auth.api.getSession).toHaveBeenCalledWith({
      headers: expect.objectContaining({ get: expect.any(Function) }),
    });
    expect(linksService.create).toHaveBeenCalledWith({
      destinationUrl: "https://example.com/portfolio",
      requestedOrganizationId: "workspace-1",
      userId: "member-1",
    });
  });

  it("rejects a missing session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);

    await expect(
      new LinksController(linksService as never).create(
        {},
        requestFrom("http://app.localhost:8080"),
      ),
    ).rejects.toEqual(new UnauthorizedException());
  });

  it("rejects a missing or untrusted origin before checking a session", async () => {
    await expect(
      new LinksController(linksService as never).create(
        {},
        requestFrom("https://untrusted.example"),
      ),
    ).rejects.toEqual(
      new ForbiddenException("Link publication must originate from the dashboard."),
    );
    await expect(
      new LinksController(linksService as never).create({}, requestFrom()),
    ).rejects.toEqual(
      new ForbiddenException("Link publication must originate from the dashboard."),
    );
    expect(auth.api.getSession).not.toHaveBeenCalled();
  });
});

function requestFrom(origin?: string) {
  return {
    get: (name: string) => (name === "origin" ? origin : undefined),
    headers: { cookie: ["session=first", "session=second"] },
  } as never;
}
