import { describe, expect, it, vi } from "vitest";
import { WorkspaceInvitationService } from "./workspace-invitation.service.js";

describe("WorkspaceInvitationService", () => {
  it("atomically deletes only an unexpired pending invitation for an owner", async () => {
    const member = { findUnique: vi.fn().mockResolvedValue({ role: "owner" }) };
    const invitation = { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) };
    const service = WorkspaceInvitationService.forTesting({ invitation, member } as never);

    await expect(
      service.cancelPendingInvitation({
        invitationId: "AbCdEfGhIjKlMnOpQrStUvWxYz012345",
        organizationId: "workspace-1",
        userId: "user-1",
      }),
    ).resolves.toBeUndefined();

    expect(invitation.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "AbCdEfGhIjKlMnOpQrStUvWxYz012345",
        organizationId: "workspace-1",
        status: "pending",
      }),
    });
  });

  it("rejects a non-owner before attempting cancellation", async () => {
    const member = { findUnique: vi.fn().mockResolvedValue({ role: "editor" }) };
    const invitation = { deleteMany: vi.fn() };
    const service = WorkspaceInvitationService.forTesting({ invitation, member } as never);

    await expect(
      service.cancelPendingInvitation({
        invitationId: "id",
        organizationId: "workspace",
        userId: "user",
      }),
    ).rejects.toThrow("Forbidden");
    expect(invitation.deleteMany).not.toHaveBeenCalled();
  });
});
