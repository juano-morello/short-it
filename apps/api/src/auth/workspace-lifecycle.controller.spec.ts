import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "./auth.js";
import { WorkspaceCreationRateLimiter } from "./workspace-creation-rate-limiter.js";
import { WorkspaceLifecycleController } from "./workspace-lifecycle.controller.js";
import type { WorkspaceLifecycleService } from "./workspace-lifecycle.service.js";

vi.mock("./auth.js", () => ({ auth: { api: { getSession: vi.fn() } } }));

describe("WorkspaceLifecycleController", () => {
  const create = vi.fn();
  const controller = new WorkspaceLifecycleController(
    {
      create,
    } as unknown as WorkspaceLifecycleService,
    new WorkspaceCreationRateLimiter(),
  );

  beforeEach(() => vi.resetAllMocks());

  it("creates only for the authenticated session user at a trusted dashboard origin", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "user-1" } } as never);

    await expect(
      controller.createWorkspace(
        { name: "Ada Studio", slug: "ada", userId: "other-user" } as never,
        request({ origin: "http://app.localhost:8080", "x-request-id": "workspace-123" }),
      ),
    ).resolves.toBeUndefined();

    expect(create).toHaveBeenCalledWith({
      name: "Ada Studio",
      requestId: "workspace-123",
      slug: "ada",
      userId: "user-1",
    });
  });

  it("requires an authenticated session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    await expect(
      controller.createWorkspace({}, request({ origin: "http://app.localhost:8080" })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("takes the authenticated user's workspace creation budget before creating", async () => {
    const take = vi.fn();
    const limitedController = new WorkspaceLifecycleController(
      { create } as unknown as WorkspaceLifecycleService,
      { take } as unknown as WorkspaceCreationRateLimiter,
    );
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "user-1" } } as never);

    await limitedController.createWorkspace(
      { name: "Ada Studio", slug: "ada" },
      request({ origin: "http://app.localhost:8080" }),
    );

    expect(take).toHaveBeenCalledWith("user-1");
  });

  it("rejects requests outside the dashboard origin", async () => {
    await expect(
      controller.createWorkspace({}, request({ origin: "https://untrusted.example" })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

function request(headers: Record<string, string>): Request {
  return { get: (name: string) => headers[name.toLowerCase()], headers } as Request;
}
