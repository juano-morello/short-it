import { authClient } from "./auth-client.js";

export const workspaceGateway = {
  createWorkspace: (input: { name: string; slug: string }) =>
    authClient.organization.create({ keepCurrentActiveOrganization: true, ...input }),
  getSession: () => authClient.getSession(),
  getWorkspace: (organizationId: string) =>
    authClient.organization.getFullOrganization({ query: { organizationId } }),
  listWorkspaces: () => authClient.organization.list(),
  signIn: (input: { email: string; password: string }) => authClient.signIn.email(input),
  signUp: (input: { email: string; name: string; password: string }) =>
    authClient.signUp.email(input),
};
