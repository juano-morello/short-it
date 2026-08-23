import { Logger, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { prisma } from "../database.js";

type LifecycleDatabase = Pick<typeof prisma, "$transaction">;
type LifecycleTransactionOptions = { requestId?: string };

const lifecycleTransactionLogger = new Logger("WorkspaceLifecycleTransaction");
const maximumTransactionAttempts = 3;

export async function runWorkspaceLifecycleTransaction<T>(
  database: LifecycleDatabase,
  userId: string,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  options: LifecycleTransactionOptions = {},
): Promise<T> {
  for (let attempt = 1; attempt <= maximumTransactionAttempts; attempt += 1) {
    try {
      const result = await database.$transaction(
        async (transaction) => {
          if (!(await lockWorkspaceLifecycleUser(transaction, userId))) {
            throw new UnauthorizedException();
          }
          return operation(transaction);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          maxWait: 1_000,
          timeout: 5_000,
        },
      );
      if (attempt > 1) logLifecycleTransaction("committed_after_retry", attempt, options.requestId);
      return result;
    } catch (error) {
      if (!isRetryableTransactionError(error)) throw error;
      if (attempt === maximumTransactionAttempts) {
        logLifecycleTransaction("temporarily_unavailable", attempt, options.requestId);
        throw new ServiceUnavailableException(
          "Workspace lifecycle request is temporarily unavailable. Please retry.",
        );
      }

      logLifecycleTransaction("retrying", attempt, options.requestId);
      await delayBeforeRetry(attempt);
    }
  }

  throw new ServiceUnavailableException(
    "Workspace lifecycle request is temporarily unavailable. Please retry.",
  );
}

async function lockWorkspaceLifecycleUser(
  transaction: Prisma.TransactionClient,
  userId: string,
): Promise<boolean> {
  const lockedUsers = await transaction.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE
  `;
  return lockedUsers.length === 1;
}

function isRetryableTransactionError(error: unknown): boolean {
  if (hasSqlState(error, "40001")) return true;
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === "P2034") return true;
  return (
    error.code === "P2028" &&
    /timeout|timed out|\bexpired\b|unable to start a transaction in the given time/i.test(
      error.message,
    )
  );
}

function hasSqlState(error: unknown, sqlState: string): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { cause?: unknown; code?: unknown; originalCode?: unknown };
  if (candidate.code === sqlState || candidate.originalCode === sqlState) return true;
  if (!candidate.cause || typeof candidate.cause !== "object") return false;
  const cause = candidate.cause as { code?: unknown; originalCode?: unknown };
  return cause.code === sqlState || cause.originalCode === sqlState;
}

async function delayBeforeRetry(attempt: number): Promise<void> {
  const baseDelayMs = attempt * 25;
  const jitterMs = Math.floor(Math.random() * 25);
  await new Promise<void>((resolve) => setTimeout(resolve, baseDelayMs + jitterMs));
}

function logLifecycleTransaction(
  outcome: "committed_after_retry" | "retrying" | "temporarily_unavailable",
  attempt: number,
  requestId: string | undefined,
): void {
  lifecycleTransactionLogger.log(
    JSON.stringify({
      attempt,
      event: "workspace_lifecycle_transaction",
      outcome,
      requestId: requestId ?? "unavailable",
    }),
  );
}
