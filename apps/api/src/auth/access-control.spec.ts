import { describe, expect, it } from "vitest";
import { canCreateLinks, workspaceRoles } from "./access-control.js";

describe("workspace roles", () => {
  it("gives owners the Better Auth organization and invite permissions", () => {
    expect(workspaceRoles.owner).toBeDefined();
  });

  it.each([
    ["owner", true],
    ["editor", true],
    ["analyst", false],
    ["analyst,editor", true],
    ["unknown", false],
  ])("derives link creation permission for %s", (role, expected) => {
    expect(canCreateLinks(role)).toBe(expected);
  });
});
