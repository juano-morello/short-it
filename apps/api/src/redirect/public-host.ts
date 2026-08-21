import { isWorkspaceHandle } from "../auth/workspace-handle.js";

const publishedLinkSlugPattern = /^c[a-z0-9]{24}$/;

export function getPublicWorkspaceHandle(
  hostHeader: string | undefined,
  baseDomain: string,
): string | undefined {
  if (!hostHeader) return undefined;

  const match = /^(?<hostname>[^:]+)(?::(?<port>\d+))?$/.exec(hostHeader);
  if (!match?.groups) return undefined;
  const { hostname, port } = match.groups;
  if (port && (!/^[1-9]\d{0,4}$/.test(port) || Number(port) > 65_535)) return undefined;

  const suffix = `.${baseDomain}`;
  if (!hostname.endsWith(suffix)) return undefined;
  const workspaceHandle = hostname.slice(0, -suffix.length);
  if (!isWorkspaceHandle(workspaceHandle)) {
    return undefined;
  }

  return workspaceHandle;
}

export function isPublishedLinkSlug(value: string): boolean {
  return publishedLinkSlugPattern.test(value);
}
