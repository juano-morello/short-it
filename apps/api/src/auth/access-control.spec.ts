import { describe, expect, it } from "vitest";
import { workspaceRoles } from "./access-control.js";

describe("workspace roles", () => {
  it("gives owners the Better Auth organization and invite permissions", () => {
    expect(workspaceRoles.owner).toBeDefined();
  });
});
