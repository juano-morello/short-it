import { createAccessControl } from "better-auth/plugins";

const statements = {
  link: ["create", "read", "delete"],
  analytics: ["read"],
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
} as const;

export const workspaceAccessControl = createAccessControl(statements);

const workspaceRolePermissions = {
  analyst: {
    analytics: ["read"],
    link: ["read"],
  },
  editor: {
    analytics: ["read"],
    link: ["create", "read", "delete"],
  },
  owner: {
    analytics: ["read"],
    invitation: ["create", "cancel"],
    link: ["create", "read", "delete"],
    member: ["create", "update", "delete"],
    organization: ["update", "delete"],
  },
} as const;

export const workspaceRoles = {
  analyst: workspaceAccessControl.newRole(workspaceRolePermissions.analyst),
  editor: workspaceAccessControl.newRole(workspaceRolePermissions.editor),
  owner: workspaceAccessControl.newRole(workspaceRolePermissions.owner),
};

export function canCreateLinks(role: string): boolean {
  return role.split(",").some((assignedRole) => {
    const permissions =
      workspaceRolePermissions[assignedRole as keyof typeof workspaceRolePermissions];
    return (permissions?.link as readonly string[] | undefined)?.includes("create") ?? false;
  });
}

export function canReadLinks(role: string): boolean {
  return role.split(",").some((assignedRole) => {
    const permissions =
      workspaceRolePermissions[assignedRole as keyof typeof workspaceRolePermissions];
    return (permissions?.link as readonly string[] | undefined)?.includes("read") ?? false;
  });
}

export function canManageInvitations(role: string): boolean {
  return role.split(",").some((assignedRole) => {
    const permissions =
      workspaceRolePermissions[assignedRole as keyof typeof workspaceRolePermissions];
    const invitationPermissions =
      permissions && "invitation" in permissions
        ? (permissions.invitation as readonly string[])
        : undefined;
    return (
      invitationPermissions?.includes("create") === true && invitationPermissions.includes("cancel")
    );
  });
}

export function canReadAnalytics(role: string): boolean {
  return role.split(",").some((assignedRole) => {
    const permissions =
      workspaceRolePermissions[assignedRole as keyof typeof workspaceRolePermissions];
    return (permissions?.analytics as readonly string[] | undefined)?.includes("read") ?? false;
  });
}
