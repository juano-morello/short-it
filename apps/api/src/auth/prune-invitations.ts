import { prisma } from "../database.js";
import { pruneExpiredInvitations } from "./invitation-retention.js";

async function prune(): Promise<void> {
  const result = await pruneExpiredInvitations(prisma, new Date());
  console.log(JSON.stringify({ event: "workspace_invitations_pruned", ...result }));
}

void prune()
  .catch((error: unknown) => {
    console.error(
      JSON.stringify({
        event: "workspace_invitations_prune_failed",
        outcome: error instanceof Error ? error.name : "unknown",
      }),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
