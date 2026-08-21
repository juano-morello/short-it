import { describe, expect, it } from "vitest";
import { getPublicWorkspaceHandle, isPublishedLinkSlug } from "./public-host.js";

describe("public redirect host policy", () => {
  it("extracts one valid workspace label from the configured base domain", () => {
    expect(getPublicWorkspaceHandle("ada-studio.short.it", "short.it")).toBe("ada-studio");
    expect(getPublicWorkspaceHandle("ada-studio.localhost:8080", "localhost")).toBe("ada-studio");
  });

  it.each([
    "short.it",
    "app.short.it",
    "api.short.it",
    "www.short.it",
    "ada.short.it.evil.example",
    "team.ada.short.it",
    "Ada.short.it",
    "ada.short.it.",
    "ada--studio.short.it",
    "a.short.it",
    "ab.short.it",
    `${"a".repeat(31)}.short.it`,
    "ada.short.it:0",
    "ada.short.it:65536",
  ])("rejects a host that is not one valid public workspace: %s", (host) => {
    expect(getPublicWorkspaceHandle(host, "short.it")).toBeUndefined();
  });

  it("accepts workspace host labels at the supported length boundaries", () => {
    expect(getPublicWorkspaceHandle("abc.short.it", "short.it")).toBe("abc");
    expect(getPublicWorkspaceHandle(`${"a".repeat(30)}.short.it`, "short.it")).toBe("a".repeat(30));
  });

  it("accepts only the launch CUID path segment", () => {
    expect(isPublishedLinkSlug("cmf4fvwfl0000q47d6kh4wq9p")).toBe(true);
    expect(isPublishedLinkSlug("CMF4FVWFL0000Q47D6KH4WQ9P")).toBe(false);
    expect(isPublishedLinkSlug("vanity-slug")).toBe(false);
    expect(isPublishedLinkSlug("cmf4fvwfl0000q47d6kh4wq9p/extra")).toBe(false);
  });
});
