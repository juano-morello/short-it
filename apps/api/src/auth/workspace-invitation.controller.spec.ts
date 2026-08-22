import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

vi.mock("./auth.js", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { auth } from "./auth.js";
import { WorkspaceInvitationController } from "./workspace-invitation.controller.js";

describe("WorkspaceInvitationController", () => {
  it("requires an authenticated session to cancel an invitation", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    const cancelPendingInvitation = vi.fn();
    const controller = new WorkspaceInvitationController({ cancelPendingInvitation } as never);

    await expect(
      controller.cancel("workspace-1", "invitation-1", { headers: {} } as never),
    ).rejects.toEqual(new UnauthorizedException());
    expect(cancelPendingInvitation).not.toHaveBeenCalled();
  });

  it("uses the authenticated user and requested workspace when cancelling", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "owner-1" } } as never);
    const cancelPendingInvitation = vi.fn().mockResolvedValue(undefined);
    const controller = new WorkspaceInvitationController({ cancelPendingInvitation } as never);

    await expect(
      controller.cancel("workspace-1", "invitation-1", {
        headers: { cookie: ["session=a", "csrf=b"], "x-ignored": undefined },
      } as never),
    ).resolves.toBeUndefined();

    expect(auth.api.getSession).toHaveBeenCalledWith({
      headers: expect.any(Headers),
    });
    expect(cancelPendingInvitation).toHaveBeenCalledWith({
      invitationId: "invitation-1",
      organizationId: "workspace-1",
      userId: "owner-1",
    });
  });
});
