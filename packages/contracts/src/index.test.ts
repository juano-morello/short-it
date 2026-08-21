import { describe, expect, it } from "vitest";
import { workspaceRoles } from "./index.js";

describe("workspaceRoles", () => {
  it("publishes the approved static workspace role names", () => {
    expect(workspaceRoles).toEqual(["owner", "editor", "analyst"]);
  });
});
