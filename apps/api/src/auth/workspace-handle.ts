import { APIError } from "better-auth";

const reservedHandles = new Set(["api", "app", "www"]);
const workspaceHandlePattern = /^(?!.*--)[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/;

export function getWorkspaceHandleError(handle: string | undefined): string | undefined {
  if (!handle || !workspaceHandlePattern.test(handle)) {
    return "Workspace handles use 3 to 30 lowercase letters, digits, and internal hyphens.";
  }

  if (reservedHandles.has(handle)) {
    return "That workspace handle is reserved.";
  }

  return undefined;
}

export function isWorkspaceHandle(handle: string | undefined): handle is string {
  return (
    typeof handle === "string" &&
    workspaceHandlePattern.test(handle) &&
    !reservedHandles.has(handle)
  );
}

export function assertWorkspaceHandle(handle: string | undefined): void {
  const error = getWorkspaceHandleError(handle);

  if (error) {
    throw new APIError("BAD_REQUEST", { message: error });
  }
}
