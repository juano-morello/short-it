import type { prisma } from "../database.js";

type InvitationPruneDatabase = Pick<typeof prisma, "invitation">;

export async function pruneExpiredInvitations(
  database: InvitationPruneDatabase,
  now: Date,
): Promise<{ expiredInvitations: number }> {
  const expiredInvitations = await database.invitation.deleteMany({
    where: {
      OR: [{ status: { not: "pending" } }, { expiresAt: { lte: now } }],
    },
  });
  return { expiredInvitations: expiredInvitations.count };
}
