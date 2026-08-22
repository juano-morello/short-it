import { EventEmitter } from "node:events";
import { Logger } from "@nestjs/common";
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { auditDeletion } from "./deletion-audit.middleware.js";

describe("auditDeletion", () => {
  it("logs a privacy-safe outcome with a request ID", () => {
    const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const response = Object.assign(new EventEmitter(), { statusCode: 403 }) as Response;
    const next = vi.fn();

    auditDeletion("workspace_deletion")(
      { get: (name: string) => (name === "x-request-id" ? "delete-123" : undefined) } as Request,
      response,
      next,
    );
    response.emit("finish");

    expect(next).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(
        /"durationMs":\d+.*"event":"workspace_deletion".*"outcome":"rejected".*"requestId":"delete-123".*"status":403/,
      ),
    );
  });
});
