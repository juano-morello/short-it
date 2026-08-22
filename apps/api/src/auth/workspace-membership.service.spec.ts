import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceMembershipService } from "./workspace-membership.service.js";

describe("WorkspaceMembershipService", () => {
  it("returns only the caller's role for the requested workspace", async () => {
    const findUnique = vi.fn().mockResolvedValue({ role: "editor" });
    const service = WorkspaceMembershipService.forTesting({
      member: { findUnique },
    } as never);

    await expect(
      service.getMembership({ organizationId: "workspace-1", userId: "user-1" }),
    ).resolves.toEqual({ role: "editor" });
    expect(findUnique).toHaveBeenCalledWith({
      select: { role: true },
      where: { organizationId_userId: { organizationId: "workspace-1", userId: "user-1" } },
    });
  });

  it("does not return another workspace's membership", async () => {
    const service = WorkspaceMembershipService.forTesting({
      member: { findUnique: vi.fn().mockResolvedValue(null) },
    } as never);

    await expect(
      service.getMembership({ organizationId: "workspace-2", userId: "user-1" }),
    ).rejects.toEqual(new ForbiddenException("You do not have access to this workspace."));
  });
});
