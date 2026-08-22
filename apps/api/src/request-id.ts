import { randomUUID } from "node:crypto";
import type { Request } from "express";

export function getRequestId(request: Pick<Request, "get">): string {
  const value = request.get("x-request-id");
  return value && /^[a-zA-Z0-9_-]{1,64}$/.test(value) ? value : randomUUID();
}
