import { BadRequestException, ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AccountDeletionService } from "./account-deletion.service.js";

describe("AccountDeletionService", () => {
  it("deletes only the authenticated user after matching their email and finding no ownership", async () => {
    const lockUser = vi.fn().mockResolvedValue([{ id: "member-1" }]);
    const member = { findMany: vi.fn().mockResolvedValue([{ role: "editor" }]) };
    const user = { delete: vi.fn().mockResolvedValue({}) };
    const service = AccountDeletionService.forTesting({
      database: {
        $transaction: (operation: (transaction: never) => Promise<unknown>) =>
          operation({ $queryRaw: lockUser, member, user } as never),
      } as never,
    });

    await expect(
      service.delete({
        confirmationEmail: "member@example.test",
        email: "member@example.test",
        userId: "member-1",
      }),
    ).resolves.toBeUndefined();

    expect(member.findMany).toHaveBeenCalledWith({
      select: { role: true },
      where: { userId: "member-1" },
    });
    expect(lockUser).toHaveBeenCalledOnce();
    expect(lockUser.mock.invocationCallOrder[0]).toBeLessThan(
      member.findMany.mock.invocationCallOrder[0],
    );
    expect(user.delete).toHaveBeenCalledWith({ where: { id: "member-1" } });
  });

  it("rejects a mismatched email confirmation before querying the database", async () => {
    const member = { findMany: vi.fn() };
    const user = { delete: vi.fn() };
    const service = AccountDeletionService.forTesting({
      database: {
        $transaction: (operation: (transaction: never) => Promise<unknown>) =>
          operation({ member, user } as never),
      } as never,
    });

    await expect(
      service.delete({
        confirmationEmail: "wrong@example.test",
        email: "member@example.test",
        userId: "member-1",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(member.findMany).not.toHaveBeenCalled();
    expect(user.delete).not.toHaveBeenCalled();
  });

  it("rejects deletion when the authenticated user was removed before the lifecycle lock", async () => {
    const member = { findMany: vi.fn() };
    const user = { delete: vi.fn() };
    const service = AccountDeletionService.forTesting({
      database: {
        $transaction: (operation: (transaction: never) => Promise<unknown>) =>
          operation({ $queryRaw: vi.fn().mockResolvedValue([]), member, user } as never),
      } as never,
    });

    await expect(
      service.delete({
        confirmationEmail: "member@example.test",
        email: "member@example.test",
        userId: "member-1",
      }),
    ).rejects.toMatchObject({ status: 401 });

    expect(member.findMany).not.toHaveBeenCalled();
    expect(user.delete).not.toHaveBeenCalled();
  });

  it.each(["owner", "analyst,owner"])(
    "rejects account deletion while the user owns a %s workspace",
    async (role) => {
      const lockUser = vi.fn().mockResolvedValue([{ id: "owner-1" }]);
      const member = { findMany: vi.fn().mockResolvedValue([{ role }]) };
      const user = { delete: vi.fn() };
      const service = AccountDeletionService.forTesting({
        database: {
          $transaction: (operation: (transaction: never) => Promise<unknown>) =>
            operation({ $queryRaw: lockUser, member, user } as never),
        } as never,
      });

      await expect(
        service.delete({
          confirmationEmail: "owner@example.test",
          email: "owner@example.test",
          userId: "owner-1",
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(user.delete).not.toHaveBeenCalled();
    },
  );
});
