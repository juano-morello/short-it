import { describe, expect, it, vi } from "vitest";
import { pruneExpiredInvitations } from "./invitation-retention.js";

describe("pruneExpiredInvitations", () => {
  it("deletes terminal invitations and pending invitations expired at or before the current time", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 3 });
    const now = new Date("2026-08-22T15:00:00.000Z");

    await expect(
      pruneExpiredInvitations({ invitation: { deleteMany } } as never, now),
    ).resolves.toEqual({ expiredInvitations: 3 });

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [{ status: { not: "pending" } }, { expiresAt: { lte: now } }],
      },
    });
  });
});
