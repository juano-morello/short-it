import { Logger } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { getRequestId } from "../request-id.js";

type DeletionEvent = "account_deletion" | "workspace_deletion";

const logger = new Logger("DeletionAudit");

export function auditDeletion(event: DeletionEvent) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const requestId = getRequestId(request);
    const startedAt = performance.now();

    response.once("finish", () => {
      const status = response.statusCode;
      logger.log(
        JSON.stringify({
          durationMs: Math.round(performance.now() - startedAt),
          event,
          outcome: status >= 200 && status < 300 ? "deleted" : status < 500 ? "rejected" : "failed",
          requestId,
          status,
        }),
      );
    });

    next();
  };
}
