import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../database.js", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from "../database.js";
import { HealthController } from "./health.controller.js";

describe("HealthController", () => {
  afterEach(() => vi.clearAllMocks());

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

  it("does not report ready when PostgreSQL is unavailable", async () => {
    const failure = new Error("PostgreSQL is unavailable");
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(failure);

    await expect(new HealthController().ready()).rejects.toBe(failure);
  });
});
