import { authClient } from "./auth-client.js";

type CreatedWorkspace = { id: string; name: string; slug: string };

export const workspaceGateway = {
  acceptInvitation: async (invitationId: string) => {
    try {
      const result = await authClient.organization.acceptInvitation({ invitationId });
      if (!result.error) return { data: result.data };
      const status = Number((result.error as { status?: unknown }).status);
      return { error: result.error, retryable: !Number.isFinite(status) || status >= 500 };
    } catch {
      return { error: { message: "Invitation cannot be accepted." }, retryable: true };
    }
  },
  cancelInvitation: async (organizationId: string, invitationId: string) => {
    try {
      const response = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/invitations/${encodeURIComponent(invitationId)}`,
        { credentials: "same-origin", method: "DELETE" },
      );
      return response.ok ? { data: {} } : { error: { message: "Invitation cannot be cancelled." } };
    } catch {
      return { error: { message: "Invitation cannot be cancelled." } };
    }
  },
  createWorkspace: async (input: { name: string; slug: string }) => {
    try {
      const response = await fetch("/api/workspaces", {
        body: JSON.stringify(input),
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const body = (await response.json()) as CreatedWorkspace & { message?: string };
      return response.ok
        ? { data: { id: body.id, name: body.name, slug: body.slug } }
        : { error: { message: body.message } };
    } catch {
      return { error: { message: "Workspace cannot be created." } };
    }
  },
  deleteAccount: async (confirmationEmail: string) => {
    try {
      const response = await fetch("/api/account", {
        body: JSON.stringify({ confirmationEmail }),
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        method: "DELETE",
      });
      return response.ok ? { data: {} } : { error: { message: "Account deletion was rejected." } };
    } catch {
      return { error: { message: "Account deletion was unavailable." } };
    }
  },
  deleteWorkspace: async (organizationId: string) => {
    try {
      const response = await fetch("/api/auth/organization/delete", {
        body: JSON.stringify({ organizationId }),
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      return response.ok
        ? { data: {} }
        : { error: { message: "Workspace deletion was rejected." } };
    } catch {
      return { error: { message: "Workspace deletion was unavailable." } };
    }
  },
  getSession: () => authClient.getSession(),
  getMembership: async (organizationId: string) => {
    try {
      const response = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/membership`,
        {
          credentials: "same-origin",
        },
      );
      const data = (await response.json()) as { role?: string; message?: string };
      return response.ok && typeof data.role === "string"
        ? { data: { role: data.role } }
        : { error: { message: "We couldn't load your workspace membership." } };
    } catch {
      return { error: { message: "We couldn't load your workspace membership." } };
    }
  },
  inviteMember: (input: { email: string; organizationId: string; role: "analyst" | "editor" }) =>
    // The server is the authorization boundary. Better Auth's default client role union does not
    // include this application's approved analyst and editor roles.
    authClient.organization.inviteMember(input as never),
  listInvitations: (organizationId: string) =>
    authClient.organization.listInvitations({ query: { organizationId } }),
  listWorkspaces: () => authClient.organization.list(),
  signIn: (input: { email: string; password: string }) => authClient.signIn.email(input),
  signUp: (input: { email: string; name: string; password: string }) =>
    authClient.signUp.email(input),
};
