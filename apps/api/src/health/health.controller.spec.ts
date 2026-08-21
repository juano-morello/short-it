import { describe, expect, it, vi } from "vitest";

vi.mock("../database.js", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from "../database.js";
import { HealthController } from "./health.controller.js";

describe("HealthController", () => {
  it("reports the process as healthy", () => {
    expect(new HealthController().health()).toEqual({
      status: "ok",
      service: "short-it-api",
    });
  });

  it("reports ready only after PostgreSQL responds", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

    await expect(new HealthController().ready()).resolves.toEqual({
      status: "ok",
      service: "short-it-api",
      database: "ready",
    });
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
  });
});
