import { describe, expect, it } from "vitest";
import { assertWorkspaceHandle, getWorkspaceHandleError } from "./workspace-handle.js";

describe("workspace handle policy", () => {
  it("accepts a lowercase handle with internal hyphens", () => {
    expect(getWorkspaceHandleError("ada-studio-01")).toBeUndefined();
  });

  it.each(["Ada", "ada_01", "ada--studio", "-ada", "ada-", "a", "ab", "a".repeat(31)])(
    "rejects an invalid public handle: %s",
    (handle) => {
      expect(getWorkspaceHandleError(handle)).toContain("Workspace handles");
    },
  );

  it.each([
    ["a", false],
    ["ab", false],
    ["abc", true],
    ["a".repeat(30), true],
    ["a".repeat(31), false],
  ])("enforces the 3 to 30 character boundary for %s", (handle, isValid) => {
    expect(getWorkspaceHandleError(handle) === undefined).toBe(isValid);
  });

  it.each(["api", "app", "www"])("reserves the platform handle: %s", (handle) => {
    expect(getWorkspaceHandleError(handle)).toBe("That workspace handle is reserved.");
  });

  it("rejects an omitted handle at the server boundary", () => {
    expect(getWorkspaceHandleError(undefined)).toContain("Workspace handles");
  });

  it("throws only when the server boundary receives an invalid handle", () => {
    expect(() => assertWorkspaceHandle("ada-studio")).not.toThrow();
    expect(() => assertWorkspaceHandle("ada--studio")).toThrow("Workspace handles");
  });
});
