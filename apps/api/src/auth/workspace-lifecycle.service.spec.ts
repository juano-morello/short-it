import { BadRequestException, ConflictException, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceLifecycleService } from "./workspace-lifecycle.service.js";

describe("WorkspaceLifecycleService", () => {
  it("creates the workspace and its owner membership in one serializable transaction", async () => {
    const user = { findUnique: vi.fn().mockResolvedValue({ id: "user-1" }) };
    const member = {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: "member-1", role: "owner", userId: "user-1" }),
    };
    const organization = {
      create: vi.fn().mockResolvedValue({ id: "workspace-1", name: "Ada Studio", slug: "ada" }),
    };
    const transaction = vi.fn(async (operation, options) => {
      expect(options).toMatchObject({ isolationLevel: "Serializable" });
      return operation({ member, organization, user });
    });
    const service = WorkspaceLifecycleService.forTesting({
      database: { $transaction: transaction } as never,
    });

    await expect(
      service.create({ name: "Ada Studio", slug: "ada", userId: "user-1" }),
    ).resolves.toEqual({
      id: "workspace-1",
      name: "Ada Studio",
      slug: "ada",
    });

    expect(organization.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: "Ada Studio", slug: "ada" }),
    });
    expect(member.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "workspace-1",
        role: "owner",
        userId: "user-1",
      }),
    });
  });

  it("rejects invalid handles before opening a transaction", async () => {
    const transaction = vi.fn();
    const service = WorkspaceLifecycleService.forTesting({
      database: { $transaction: transaction } as never,
    });

    await expect(
      service.create({ name: "Ada Studio", slug: "app", userId: "user-1" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects creation after account deletion wins the lifecycle transaction", async () => {
    const transaction = vi.fn(async (operation) =>
      operation({ user: { findUnique: vi.fn().mockResolvedValue(null) } }),
    );
    const service = WorkspaceLifecycleService.forTesting({
      database: { $transaction: transaction } as never,
    });

    await expect(
      service.create({ name: "Ada Studio", slug: "ada", userId: "user-1" }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("keeps the existing creation limit", async () => {
    const transaction = vi.fn(async (operation) =>
      operation({
        member: { count: vi.fn().mockResolvedValue(3) },
        user: { findUnique: vi.fn().mockResolvedValue({ id: "user-1" }) },
      }),
    );
    const service = WorkspaceLifecycleService.forTesting({
      database: { $transaction: transaction } as never,
    });

    await expect(
      service.create({ name: "Ada Studio", slug: "ada", userId: "user-1" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
