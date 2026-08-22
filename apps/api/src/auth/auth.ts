import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware, getAuthoritativeSessionFromCtx } from "better-auth/api";
import { organization } from "better-auth/plugins";
import { getConfig } from "../config.js";
import { prisma } from "../database.js";
import { canManageInvitations, workspaceAccessControl, workspaceRoles } from "./access-control.js";
import { assertDisplayName } from "./display-name.js";
import { assertWorkspaceHandle } from "./workspace-handle.js";

const config = getConfig();
const invitationIdPattern = /^[A-Za-z0-9]{32}$/;

function assertInvitationRole(role: unknown): asserts role is "editor" | "analyst" {
  if (role !== "editor" && role !== "analyst") {
    throw new APIError("BAD_REQUEST", { message: "Invitation roles must be editor or analyst." });
  }
}

function assertPendingInvitation(invitation: { expiresAt: Date; status: string }): void {
  if (invitation.status !== "pending" || invitation.expiresAt <= new Date()) {
    throw new APIError("BAD_REQUEST", { message: "Invitation cannot be used." });
  }
}

async function requireInvitationOwner(
  context: Parameters<typeof getAuthoritativeSessionFromCtx>[0],
  explicitOrganizationId?: unknown,
) {
  const session = await getAuthoritativeSessionFromCtx(context);
  if (!session) {
    throw new APIError("UNAUTHORIZED");
  }

  const organizationId = explicitOrganizationId ?? context.query?.organizationId;
  if (typeof organizationId !== "string" || !organizationId) {
    throw new APIError("BAD_REQUEST", { message: "Organization ID is required." });
  }

  const member = await prisma.member.findUnique({
    select: { role: true },
    where: {
      organizationId_userId: {
        organizationId,
        userId: session.user.id,
      },
    },
  });
  if (!member || !canManageInvitations(member.role)) {
    throw new APIError("FORBIDDEN");
  }
}

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

      if (
        context.path === "/organization/list-invitations" ||
        context.path === "/organization/get-full-organization"
      ) {
        await requireInvitationOwner(context);
      }

      if (context.path === "/organization/get-invitation") {
        throw new APIError("NOT_FOUND");
      }

      if (
        context.path === "/organization/cancel-invitation" ||
        context.path === "/organization/list-user-invitations" ||
        context.path === "/organization/reject-invitation"
      ) {
        throw new APIError("NOT_FOUND");
      }

      if (context.path === "/organization/invite-member") {
        const body = getInvitationRequestBody(context.body);
        await requireInvitationOwner(context, body.organizationId);
        if (body.resend === true) {
          throw new APIError("BAD_REQUEST", { message: "Invitation resend is not available." });
        }
      }

      if (context.path === "/organization/accept-invitation") {
        const body = getInvitationRequestBody(context.body);
        if (typeof body.invitationId !== "string" || !invitationIdPattern.test(body.invitationId)) {
          throw new APIError("BAD_REQUEST", { message: "Invitation cannot be used." });
        }
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
        beforeAcceptInvitation: async ({ invitation }) => {
          assertInvitationRole(invitation.role);
          assertPendingInvitation(invitation);
        },
        afterAcceptInvitation: async ({ invitation }) => {
          await deleteTerminalInvitation(invitation.id);
        },
        beforeCreateInvitation: async ({ invitation }) => {
          assertInvitationRole(invitation.role);
        },
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

function getInvitationRequestBody(body: unknown): {
  invitationId?: unknown;
  organizationId?: unknown;
  resend?: unknown;
} {
  if (!body || typeof body !== "object") {
    throw new APIError("BAD_REQUEST", { message: "Invitation request is invalid." });
  }
  return body;
}

async function deleteTerminalInvitation(invitationId: string): Promise<void> {
  try {
    await prisma.invitation.delete({ where: { id: invitationId } });
  } catch {
    console.error(JSON.stringify({ event: "workspace_invitation_terminal_cleanup_failed" }));
  }
}
