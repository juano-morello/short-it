import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins";
import { getConfig } from "../config.js";
import { prisma } from "../database.js";
import { workspaceAccessControl, workspaceRoles } from "./access-control.js";
import { assertWorkspaceHandle } from "./workspace-handle.js";

const config = getConfig();

export const auth = betterAuth({
  baseURL: config.baseUrl,
  trustedOrigins: config.origins,
  secret: config.secret,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
  },
  advanced: {
    ipAddress: {
      disableIpTracking: true,
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          session.ipAddress = null;
          session.userAgent = null;
          return { data: session };
        },
      },
    },
  },
  plugins: [
    organization({
      ac: workspaceAccessControl,
      roles: workspaceRoles,
      dynamicAccessControl: {
        enabled: false,
      },
      organizationLimit: 3,
      membershipLimit: 25,
      invitationLimit: 10,
      invitationExpiresIn: 60 * 60 * 24 * 7,
      requireEmailVerificationOnInvitation: false,
      organizationHooks: {
        beforeCreateOrganization: async ({ organization: workspace }) => {
          assertWorkspaceHandle(workspace.slug);
        },
      },
    }),
  ],
});
