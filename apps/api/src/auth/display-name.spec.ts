import { describe, expect, it } from "vitest";
import { assertDisplayName, getDisplayNameError } from "./display-name.js";

describe("display name policy", () => {
  it("accepts a concise visible name", () => {
    expect(getDisplayNameError("Ada Studio", "Workspace")).toBeUndefined();
  });

  it.each(["", "   ", "a".repeat(121)])("rejects a bounded visible name: %s", (name) => {
    expect(getDisplayNameError(name, "Workspace")).toContain("Workspace names");
  });

  it("asserts the name policy at the auth boundary", () => {
    expect(() => assertDisplayName("Ada", "Account")).not.toThrow();
    expect(() => assertDisplayName(undefined, "Account")).toThrow(
      "Account names must contain 1 to 120 characters.",
    );
  });
});
