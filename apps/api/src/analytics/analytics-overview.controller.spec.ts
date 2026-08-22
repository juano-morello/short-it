import { UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../auth/auth.js", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { auth } from "../auth/auth.js";
import { AnalyticsOverviewController } from "./analytics-overview.controller.js";

describe("AnalyticsOverviewController", () => {
  const overviewService = { getOverview: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the authenticated session rather than a browser-supplied user identifier", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "analyst-1" } } as never);
    overviewService.getOverview.mockResolvedValue({ daily: [] });

    await expect(
      new AnalyticsOverviewController(overviewService as never).getOverview("workspace-1", {
        headers: { cookie: "session=first" },
      } as never),
    ).resolves.toEqual({ daily: [] });
    expect(overviewService.getOverview).toHaveBeenCalledWith({
      organizationId: "workspace-1",
      userId: "analyst-1",
    });
  });

  it("requires an authenticated session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);

    await expect(
      new AnalyticsOverviewController(overviewService as never).getOverview("workspace-1", {
        headers: {},
      } as never),
    ).rejects.toEqual(new UnauthorizedException());
  });
});
