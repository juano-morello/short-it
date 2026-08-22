import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Given, Then, When } from "@cucumber/cucumber";
import { pruneExpiredInvitations } from "../src/auth/invitation-retention.js";
import { prisma } from "../src/database.js";

const baseUrl = process.env.BDD_BASE_URL ?? "http://app.localhost:8080";
const dashboardOrigin = process.env.BDD_DASHBOARD_ORIGIN ?? baseUrl;
const dashboardHostHeader =
  dashboardOrigin === baseUrl ? {} : { host: new URL(dashboardOrigin).host };
const password = "correct-horse-battery-staple";

type SignedInUser = { cookie: string; email: string; id: string };
type WorkspaceOwner = SignedInUser & { workspaceId: string };
type Invitation = {
  email: string;
  id: string;
  organizationId: string;
  role: string;
  status: string;
};

let owner: WorkspaceOwner | undefined;
let recipient: SignedInUser | undefined;
let invitation: Invitation | undefined;
let invitationManagementResponses: Response[] = [];
let invitationAcceptanceResponse: Response | undefined;
let invitationRequestResponse: Response | undefined;
let invitationRaceResponses: Response[] = [];
let memberCountBeforeAcceptance = 0;
let malformedInvitationResponses: Response[] = [];
let unusedInvitationResponses: Response[] = [];

Given("an invitation-capable workspace owner", async () => {
  resetInvitationScenario();
  owner = await createWorkspaceOwner();
});

When("the owner invites {string} as an {string}", async (email: string, role: string) => {
  assert.ok(owner, "An invitation-capable workspace owner is required.");
  const response = await invite(owner, { email, role });
  assert.equal(response.status, 200);
  invitation = (await response.json()) as Invitation;
});

Then(
  "a pending {string} invitation exists for {string} in that workspace",
  async (role: string, email: string) => {
    assert.ok(owner, "An invitation-capable workspace owner is required.");
    assert.ok(invitation, "An invitation is required.");
    assert.equal(invitation.email, email);
    assert.equal(invitation.role, role);
    assert.equal(invitation.organizationId, owner.workspaceId);
    assert.equal(invitation.status, "pending");
    assert.match(invitation.id, /^[A-Za-z0-9]{32}$/);
    expectSinglePendingInvitation(await listInvitations(owner), invitation);
  },
);

Given("a signed-in workspace {string} with a pending invitation", async (role: string) => {
  resetInvitationScenario();
  assertInvitedRole(role);
  owner = await createWorkspaceOwner();
  const nonOwner = await createSignedInUser(role);
  await prisma.member.create({
    data: {
      id: randomUUID(),
      organizationId: owner.workspaceId,
      role,
      userId: nonOwner.id,
    },
  });
  recipient = nonOwner;
  invitation = await createPendingInvitation(owner, "pending@example.test", "analyst");
});

Given("a pending workspace invitation and an unrelated workspace owner", async () => {
  resetInvitationScenario();
  owner = await createWorkspaceOwner();
  invitation = await createPendingInvitation(owner, "pending@example.test", "analyst");
  recipient = await createWorkspaceOwner();
});

Given("a pending workspace invitation", async () => {
  if (!invitation) {
    assert.ok(owner, "An invitation-capable workspace owner is required.");
    invitation = await createPendingInvitation(owner, "pending@example.test", "analyst");
  }
});

When(
  "the non-owner attempts to create, list, cancel invitations, and inspect the full workspace",
  async () => {
    assert.ok(owner, "A workspace owner is required.");
    assert.ok(recipient, "A signed-in workspace editor is required.");
    assert.ok(invitation, "A pending invitation is required.");
    invitationManagementResponses = await Promise.all([
      invite(
        { ...recipient, workspaceId: owner.workspaceId },
        { email: "forbidden@example.test", role: "editor" },
      ),
      fetch(
        `${baseUrl}/api/auth/organization/list-invitations?organizationId=${owner.workspaceId}`,
        {
          headers: requestHeaders(recipient),
        },
      ),
      cancelInvitation({ ...recipient, workspaceId: owner.workspaceId }, invitation.id),
      fetch(
        `${baseUrl}/api/auth/organization/get-full-organization?organizationId=${owner.workspaceId}`,
        {
          headers: requestHeaders(recipient),
        },
      ),
    ]);
  },
);

Then("every invitation management request is forbidden", () => {
  assert.deepEqual(
    invitationManagementResponses.map((response) => response.status),
    [403, 403, 403, 403],
  );
});

Given("a pending workspace invitation for a signed-in matching recipient", async () => {
  resetInvitationScenario();
  await createInvitationForMatchingRecipient("editor");
});

Given(
  "a pending workspace invitation for a signed-in matching recipient as an {string}",
  async (role: string) => {
    resetInvitationScenario();
    assertInvitedRole(role);
    await createInvitationForMatchingRecipient(role);
  },
);

async function createInvitationForMatchingRecipient(role: "editor" | "analyst"): Promise<void> {
  owner = await createWorkspaceOwner();
  recipient = await createSignedInUser("recipient");
  invitation = await createPendingInvitation(owner, recipient.email, role);
  memberCountBeforeAcceptance = await prisma.member.count({
    where: { organizationId: owner.workspaceId, userId: recipient.id },
  });
}

When("the recipient accepts the invitation", async () => {
  assert.ok(recipient, "A matching signed-in recipient is required.");
  assert.ok(invitation, "A pending invitation is required.");
  invitationAcceptanceResponse = await acceptInvitation(recipient, invitation.id);
});

Then("the recipient becomes a {string} in that workspace", async (role: string) => {
  assertInvitedRole(role);
  assert.ok(owner, "A workspace owner is required.");
  assert.ok(recipient, "A matching signed-in recipient is required.");
  assert.ok(invitationAcceptanceResponse, "An invitation acceptance response is required.");
  assert.equal(invitationAcceptanceResponse.status, 200);
  const member = await prisma.member.findUnique({
    select: { role: true },
    where: {
      organizationId_userId: {
        organizationId: owner.workspaceId,
        userId: recipient.id,
      },
    },
  });
  assert.deepEqual(member, { role });
  assert.equal(await prisma.invitation.count({ where: { id: invitation?.id } }), 0);
  memberCountBeforeAcceptance = 1;
});

When("the recipient accepts the invitation again", async () => {
  assert.ok(recipient, "A matching signed-in recipient is required.");
  assert.ok(invitation, "A pending invitation is required.");
  invitationAcceptanceResponse = await acceptInvitation(recipient, invitation.id);
});

Then("the invitation acceptance is rejected without changing membership", async () => {
  assert.ok(owner, "A workspace owner is required.");
  assert.ok(recipient, "A matching signed-in recipient is required.");
  assert.ok(invitationAcceptanceResponse, "An invitation acceptance response is required.");
  assert.ok(invitationAcceptanceResponse.status >= 400);
  assert.equal(
    await prisma.member.count({
      where: { organizationId: owner.workspaceId, userId: recipient.id },
    }),
    memberCountBeforeAcceptance,
  );
});

Given("a different signed-in recipient", async () => {
  recipient = await createSignedInUser("different-recipient");
});

When("the different recipient accepts the invitation", async () => {
  assert.ok(recipient, "A different signed-in recipient is required.");
  assert.ok(invitation, "A pending invitation is required.");
  invitationAcceptanceResponse = await acceptInvitation(recipient, invitation.id);
});

Then("the invitation acceptance is forbidden", () => {
  assert.ok(invitationAcceptanceResponse, "An invitation acceptance response is required.");
  assert.equal(invitationAcceptanceResponse.status, 403);
});

When("the owner cancels the invitation", async () => {
  assert.ok(owner, "A workspace owner is required.");
  assert.ok(invitation, "A pending invitation is required.");
  const response = await cancelInvitation(owner, invitation.id);
  assert.equal(response.status, 204);
});

When("the recipient accepts and the owner cancels the invitation concurrently", async () => {
  assert.ok(owner, "A workspace owner is required.");
  assert.ok(recipient, "A matching signed-in recipient is required.");
  assert.ok(invitation, "A pending invitation is required.");
  invitationRaceResponses = await Promise.all([
    acceptInvitation(recipient, invitation.id),
    cancelInvitation(owner, invitation.id),
  ]);
});

Then("exactly one invitation transition takes effect", async () => {
  assert.ok(owner, "A workspace owner is required.");
  assert.ok(recipient, "A matching signed-in recipient is required.");
  assert.ok(invitation, "An invitation is required.");
  const [acceptance, cancellation] = invitationRaceResponses;
  assert.ok(acceptance, "An acceptance response is required.");
  assert.ok(cancellation, "A cancellation response is required.");
  const accepted = acceptance.status === 200;
  const cancelled = cancellation.status === 204;
  assert.notEqual(accepted, cancelled, "Acceptance and cancellation cannot both succeed.");
  assert.equal(
    await prisma.member.count({
      where: { organizationId: owner.workspaceId, userId: recipient.id },
    }),
    accepted ? 1 : memberCountBeforeAcceptance,
  );
  assert.equal(await prisma.invitation.count({ where: { id: invitation.id } }), 0);
});

Given("the invitation has expired", async () => {
  assert.ok(invitation, "A pending invitation is required.");
  await prisma.invitation.update({
    data: { expiresAt: new Date(Date.now() - 1_000) },
    where: { id: invitation.id },
  });
});

Given("immediate cleanup left the invitation terminal", async () => {
  assert.ok(invitation, "An invitation is required.");
  await prisma.invitation.update({
    data: { status: "accepted" },
    where: { id: invitation.id },
  });
});

When("expired invitations are pruned", async () => {
  await pruneExpiredInvitations(prisma, new Date());
});

When(
  "the owner attempts an invalid invitation request with role {string} and resend {string}",
  async (role: string, resend: string) => {
    assert.ok(owner, "An invitation-capable workspace owner is required.");
    invitationRequestResponse = await fetch(`${baseUrl}/api/auth/organization/invite-member`, {
      body: JSON.stringify({
        email: "invalid-invitation@example.test",
        organizationId: owner.workspaceId,
        resend: resend === "true",
        role,
      }),
      headers: requestHeaders(owner),
      method: "POST",
    });
  },
);

Then("the invitation request is rejected", () => {
  assert.ok(invitationRequestResponse, "An invitation request response is required.");
  assert.ok(invitationRequestResponse.status >= 400);
});

When("the owner attempts to reject or list user invitations", async () => {
  assert.ok(owner, "An invitation-capable workspace owner is required.");
  assert.ok(invitation, "A pending invitation is required.");
  unusedInvitationResponses = await Promise.all([
    fetch(`${baseUrl}/api/auth/organization/reject-invitation`, {
      body: JSON.stringify({ invitationId: invitation.id }),
      headers: requestHeaders(owner),
      method: "POST",
    }),
    fetch(`${baseUrl}/api/auth/organization/list-user-invitations`, {
      headers: requestHeaders(owner),
    }),
  ]);
});

Then("every unused invitation endpoint is unavailable", () => {
  assert.deepEqual(
    unusedInvitationResponses.map((response) => response.status),
    [404, 404],
  );
});

When("the owner sends malformed invitation creation and acceptance requests", async () => {
  assert.ok(owner, "An invitation-capable workspace owner is required.");
  malformedInvitationResponses = await Promise.all([
    fetch(`${baseUrl}/api/auth/organization/invite-member`, {
      headers: requestHeaders(owner),
      method: "POST",
    }),
    fetch(`${baseUrl}/api/auth/organization/accept-invitation`, {
      body: "null",
      headers: requestHeaders(owner),
      method: "POST",
    }),
  ]);
});

Then("every malformed invitation request is rejected", () => {
  assert.deepEqual(
    malformedInvitationResponses.map((response) => response.status),
    [400, 400],
  );
});

Then("the pending invitation remains unchanged", async () => {
  assert.ok(invitation, "A pending invitation is required.");
  const persisted = await prisma.invitation.findUnique({ where: { id: invitation.id } });
  assert.equal(persisted?.email, invitation.email);
  assert.equal(persisted?.organizationId, invitation.organizationId);
  assert.equal(persisted?.role, invitation.role);
  assert.equal(persisted?.status, "pending");
});

Then("the invitation record is deleted", async () => {
  assert.ok(invitation, "An invitation is required.");
  assert.equal(await prisma.invitation.count({ where: { id: invitation.id } }), 0);
});

async function createWorkspaceOwner(): Promise<WorkspaceOwner> {
  const signedIn = await createSignedInUser("owner");
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const response = await fetch(`${baseUrl}/api/workspaces`, {
    body: JSON.stringify({
      name: "Invitation Workspace",
      slug: `invites-${suffix}`,
    }),
    headers: requestHeaders(signedIn),
    method: "POST",
  });
  assert.equal(response.status, 200);
  const workspace = (await response.json()) as { id: string };
  return { ...signedIn, workspaceId: workspace.id };
}

async function createSignedInUser(prefix: string): Promise<SignedInUser> {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const email = `${prefix}-${suffix}@example.test`;
  const signUp = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    body: JSON.stringify({ email, name: "Invitation User", password }),
    headers: {
      "content-type": "application/json",
      origin: dashboardOrigin,
      ...dashboardHostHeader,
    },
    method: "POST",
  });
  assert.equal(signUp.status, 200);
  const user = (await signUp.json()) as { user?: { id?: string } };
  assert.ok(user.user?.id, "Expected sign-up to return a user ID.");
  const signIn = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    body: JSON.stringify({ email, password }),
    headers: {
      "content-type": "application/json",
      origin: dashboardOrigin,
      ...dashboardHostHeader,
    },
    method: "POST",
  });
  assert.equal(signIn.status, 200);
  const cookie = signIn.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");
  assert.ok(cookie, "Expected sign-in to establish a session.");
  return { cookie, email, id: user.user.id };
}

async function createPendingInvitation(
  currentOwner: WorkspaceOwner,
  email: string,
  role: "editor" | "analyst",
): Promise<Invitation> {
  const response = await invite(currentOwner, { email, role });
  assert.equal(response.status, 200);
  return (await response.json()) as Invitation;
}

function invite(
  currentOwner: WorkspaceOwner,
  input: { email: string; role: string },
): Promise<Response> {
  return fetch(`${baseUrl}/api/auth/organization/invite-member`, {
    body: JSON.stringify({ ...input, organizationId: currentOwner.workspaceId }),
    headers: requestHeaders(currentOwner),
    method: "POST",
  });
}

function acceptInvitation(currentRecipient: SignedInUser, invitationId: string): Promise<Response> {
  return fetch(`${baseUrl}/api/auth/organization/accept-invitation`, {
    body: JSON.stringify({ invitationId }),
    headers: requestHeaders(currentRecipient),
    method: "POST",
  });
}

function cancelInvitation(currentOwner: WorkspaceOwner, invitationId: string): Promise<Response> {
  return fetch(
    `${baseUrl}/api/organizations/${currentOwner.workspaceId}/invitations/${encodeURIComponent(invitationId)}`,
    { headers: requestHeaders(currentOwner), method: "DELETE" },
  );
}

async function listInvitations(currentOwner: WorkspaceOwner): Promise<Invitation[]> {
  const response = await fetch(
    `${baseUrl}/api/auth/organization/list-invitations?organizationId=${currentOwner.workspaceId}`,
    { headers: requestHeaders(currentOwner) },
  );
  assert.equal(response.status, 200);
  return (await response.json()) as Invitation[];
}

function requestHeaders(user: Pick<SignedInUser, "cookie">): Record<string, string> {
  return {
    "content-type": "application/json",
    cookie: user.cookie,
    origin: dashboardOrigin,
    ...dashboardHostHeader,
  };
}

function assertInvitedRole(role: string): asserts role is "analyst" | "editor" {
  assert.ok(role === "analyst" || role === "editor", `Unsupported invitation role: ${role}`);
}

function expectSinglePendingInvitation(invitations: Invitation[], expected: Invitation): void {
  assert.deepEqual(invitations, [expected]);
}

function resetInvitationScenario(): void {
  owner = undefined;
  recipient = undefined;
  invitation = undefined;
  invitationManagementResponses = [];
  invitationAcceptanceResponse = undefined;
  invitationRequestResponse = undefined;
  invitationRaceResponses = [];
  memberCountBeforeAcceptance = 0;
  malformedInvitationResponses = [];
  unusedInvitationResponses = [];
}
