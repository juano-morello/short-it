import { Logger, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runWorkspaceLifecycleTransaction } from "./workspace-lifecycle-transaction.js";

describe("runWorkspaceLifecycleTransaction", () => {
  afterEach(() => vi.restoreAllMocks());

  it("retries a serialization conflict and records the successful retry without personal data", async () => {
    const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const conflict = serializationConflict();
    const transaction = vi.fn().mockRejectedValueOnce(conflict).mockResolvedValueOnce("committed");

    await expect(
      runWorkspaceLifecycleTransaction({ $transaction: transaction } as never, async () => "done", {
        requestId: "lifecycle-123",
      }),
    ).resolves.toBe("committed");

    expect(transaction).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        '"attempt":1,"event":"workspace_lifecycle_transaction","outcome":"retrying","requestId":"lifecycle-123"',
      ),
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        '"attempt":2,"event":"workspace_lifecycle_transaction","outcome":"committed_after_retry","requestId":"lifecycle-123"',
      ),
    );
  });

  it("returns a retryable response after bounded transaction retries are exhausted", async () => {
    const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const transaction = vi.fn().mockRejectedValue(serializationConflict());

    await expect(
      runWorkspaceLifecycleTransaction({ $transaction: transaction } as never, async () => "done", {
        requestId: "lifecycle-456",
      }),
    ).rejects.toEqual(
      new ServiceUnavailableException(
        "Workspace lifecycle request is temporarily unavailable. Please retry.",
      ),
    );

    expect(transaction).toHaveBeenCalledTimes(3);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        '"attempt":3,"event":"workspace_lifecycle_transaction","outcome":"temporarily_unavailable","requestId":"lifecycle-456"',
      ),
    );
  });

  it("retries a transaction timeout", async () => {
    const transaction = vi.fn().mockRejectedValueOnce(transactionTimeout()).mockResolvedValueOnce("ok");

    await expect(
      runWorkspaceLifecycleTransaction({ $transaction: transaction } as never, async () => "done"),
    ).resolves.toBe("ok");
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it("preserves a non-timeout transaction API fault", async () => {
    const failure = new Prisma.PrismaClientKnownRequestError("unsupported nested transaction", {
      clientVersion: "test",
      code: "P2028",
    });
    const transaction = vi.fn().mockRejectedValue(failure);

    await expect(
      runWorkspaceLifecycleTransaction({ $transaction: transaction } as never, async () => "done"),
    ).rejects.toBe(failure);
    expect(transaction).toHaveBeenCalledOnce();
  });
});

function serializationConflict(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("serialization conflict", {
    clientVersion: "test",
    code: "P2034",
  });
}

function transactionTimeout(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("transaction timeout", {
    clientVersion: "test",
    code: "P2028",
  });
}
