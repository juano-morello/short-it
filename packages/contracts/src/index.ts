export type HealthStatus = {
  status: "ok";
  service: "short-it-api";
};

export type ReadinessStatus = HealthStatus & {
  database: "pending" | "ready";
};

export const workspaceRoles = ["owner", "editor", "analyst"] as const;
export type WorkspaceRole = (typeof workspaceRoles)[number];

export type CreateLinkRequest = {
  destinationUrl: string;
  organizationId: string;
};

export type PublishedLink = {
  createdAt: string;
  destinationUrl: string;
  id: string;
  organizationId: string;
  publishedAt: string;
  slug: string;
};
