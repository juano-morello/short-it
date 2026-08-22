import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

vi.mock("./auth.js", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { auth } from "./auth.js";
import { WorkspaceMembershipController } from "./workspace-membership.controller.js";

describe("WorkspaceMembershipController", () => {
  it("requires an authenticated session to read a membership", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    const getMembership = vi.fn();
    const controller = new WorkspaceMembershipController({ getMembership } as never);

    await expect(controller.getMembership("workspace-1", { headers: {} } as never)).rejects.toEqual(
      new UnauthorizedException(),
    );
    expect(getMembership).not.toHaveBeenCalled();
  });

  it("uses the authenticated user and requested workspace when reading membership", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "member-1" } } as never);
    const getMembership = vi.fn().mockResolvedValue({ role: "editor" });
    const controller = new WorkspaceMembershipController({ getMembership } as never);

    await expect(
      controller.getMembership("workspace-1", {
        headers: { cookie: ["session=a", "csrf=b"], "x-ignored": undefined },
      } as never),
    ).resolves.toEqual({ role: "editor" });

    expect(auth.api.getSession).toHaveBeenCalledWith({
      headers: expect.any(Headers),
    });
    expect(getMembership).toHaveBeenCalledWith({
      organizationId: "workspace-1",
      userId: "member-1",
    });
  });
});
