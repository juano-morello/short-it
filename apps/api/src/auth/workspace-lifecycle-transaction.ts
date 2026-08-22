import { Prisma } from "@prisma/client";
import type { prisma } from "../database.js";

type LifecycleDatabase = Pick<typeof prisma, "$transaction">;

export async function runWorkspaceLifecycleTransaction<T>(
  database: LifecycleDatabase,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await database.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 1_000,
        timeout: 5_000,
      });
    } catch (error) {
      if (!isSerializationConflict(error) || attempt === 2) throw error;
    }
  }

  throw new Error("Workspace lifecycle transaction retries were exhausted.");
}

function isSerializationConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}
