import { describe, expect, it } from "vitest";
import { getWorkspaceHandleError } from "./workspace-handle.js";

describe("workspace handle policy", () => {
  it("accepts a lowercase handle with internal hyphens", () => {
    expect(getWorkspaceHandleError("ada-studio-01")).toBeUndefined();
  });

  it.each(["Ada", "ada_01", "ada--studio", "-ada", "ada-", "ab", "a".repeat(31)])(
    "rejects an invalid public handle: %s",
    (handle) => {
      expect(getWorkspaceHandleError(handle)).toContain("Workspace handles");
    },
  );

  it.each(["api", "app", "www"])("reserves the platform handle: %s", (handle) => {
    expect(getWorkspaceHandleError(handle)).toBe("That workspace handle is reserved.");
  });
});
