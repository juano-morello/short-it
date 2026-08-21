import { describe, expect, it } from "vitest";
import { getDisplayNameError } from "./display-name.js";

describe("display name policy", () => {
  it("accepts a concise visible name", () => {
    expect(getDisplayNameError("Ada Studio", "Workspace")).toBeUndefined();
  });

  it.each(["", "   ", "a".repeat(121)])("rejects a bounded visible name: %s", (name) => {
    expect(getDisplayNameError(name, "Workspace")).toContain("Workspace names");
  });
});
