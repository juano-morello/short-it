export type HealthStatus = {
  status: "ok";
  service: "short-it-api";
};

export type ReadinessStatus = HealthStatus & {
  database: "pending" | "ready";
};

export const workspaceRoles = ["owner", "editor", "analyst"] as const;
export type WorkspaceRole = (typeof workspaceRoles)[number];
