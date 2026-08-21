import { createAccessControl } from "better-auth/plugins";

const statements = {
  link: ["create", "read", "delete"],
  analytics: ["read"],
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
} as const;

export const workspaceAccessControl = createAccessControl(statements);

export const workspaceRoles = {
  owner: workspaceAccessControl.newRole({
    link: ["create", "read", "delete"],
    analytics: ["read"],
    organization: ["update", "delete"],
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
  }),
  editor: workspaceAccessControl.newRole({
    link: ["create", "read", "delete"],
    analytics: ["read"],
    invitation: ["create", "cancel"],
  }),
  analyst: workspaceAccessControl.newRole({
    analytics: ["read"],
    link: ["read"],
  }),
};
