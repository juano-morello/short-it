import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuthMiddleware } from "better-auth/api";
import { organization } from "better-auth/plugins";
import { getConfig } from "../config.js";
import { prisma } from "../database.js";
import { workspaceAccessControl, workspaceRoles } from "./access-control.js";
import { assertDisplayName } from "./display-name.js";
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
    autoSignIn: false,
    enabled: true,
    requireEmailVerification: false,
  },
  rateLimit: {
    customRules: {
      "/sign-in/email": {
        max: 20,
        window: 10,
      },
      "/sign-up/email": {
        max: 20,
        window: 10,
      },
    },
    enabled: true,
    window: 60,
    max: 100,
  },
  advanced: {
    ipAddress: {
      ipAddressHeaders: ["x-real-ip"],
    },
  },
  hooks: {
    before: createAuthMiddleware(async (context) => {
      if (context.path === "/sign-up/email") {
        assertDisplayName(context.body.name, "Account");
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          assertDisplayName(user.name, "Account");
        },
      },
      update: {
        before: async (user) => {
          if (typeof user.name === "string") {
            assertDisplayName(user.name, "Account");
          }
        },
      },
    },
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
          assertDisplayName(workspace.name, "Workspace");
          assertWorkspaceHandle(workspace.slug);
        },
        beforeUpdateOrganization: async ({ organization: workspace }) => {
          if (typeof workspace.name === "string") {
            assertDisplayName(workspace.name, "Workspace");
          }
          if (typeof workspace.slug === "string") {
            assertWorkspaceHandle(workspace.slug);
          }
        },
      },
    }),
  ],
});
