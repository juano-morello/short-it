import { analyticsPool, analyticsPrisma } from "../database.js";
import { pruneAnalytics } from "./analytics-retention.js";

async function prune(): Promise<void> {
  const now = new Date();
  const result = await analyticsPrisma.$transaction((transaction) =>
    pruneAnalytics(transaction as never, now),
  );
  console.log(
    JSON.stringify({
      event: "redirect_analytics_pruned",
      ...result,
    }),
  );
}

void prune()
  .catch((error: unknown) => {
    console.error(
      JSON.stringify({
        event: "redirect_analytics_prune_failed",
        outcome: error instanceof Error ? error.name : "unknown",
      }),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await analyticsPrisma.$disconnect();
    await analyticsPool.end();
  });
