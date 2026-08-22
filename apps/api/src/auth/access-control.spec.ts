import { describe, expect, it } from "vitest";
import {
  canCreateLinks,
  canManageInvitations,
  canReadAnalytics,
  workspaceRoles,
} from "./access-control.js";

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

  it.each(["owner", "editor", "analyst", "analyst,editor"])(
    "allows %s to read analytics",
    (role) => {
      expect(canReadAnalytics(role)).toBe(true);
    },
  );

  it("denies unknown roles analytics access", () => {
    expect(canReadAnalytics("unknown")).toBe(false);
  });

  it.each([
    ["owner", true],
    ["editor", false],
    ["analyst", false],
    ["analyst,owner", true],
    ["unknown", false],
  ])("derives invitation management permission for %s", (role, expected) => {
    expect(canManageInvitations(role)).toBe(expected);
  });
});
