import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "./auth.js";
import { WorkspaceLifecycleController } from "./workspace-lifecycle.controller.js";
import type { WorkspaceLifecycleService } from "./workspace-lifecycle.service.js";

vi.mock("./auth.js", () => ({ auth: { api: { getSession: vi.fn() } } }));

describe("WorkspaceLifecycleController", () => {
  const create = vi.fn();
  const controller = new WorkspaceLifecycleController({
    create,
  } as unknown as WorkspaceLifecycleService);

  beforeEach(() => vi.resetAllMocks());

  it("creates only for the authenticated session user at a trusted dashboard origin", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "user-1" } } as never);

    await expect(
      controller.createWorkspace(
        { name: "Ada Studio", slug: "ada", userId: "other-user" } as never,
        request({ origin: "http://app.localhost:8080" }),
      ),
    ).resolves.toBeUndefined();

    expect(create).toHaveBeenCalledWith({ name: "Ada Studio", slug: "ada", userId: "user-1" });
  });

  it("requires an authenticated session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    await expect(
      controller.createWorkspace({}, request({ origin: "http://app.localhost:8080" })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
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
