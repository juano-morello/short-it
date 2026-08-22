import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { request } from "node:http";
import { Given, Then, When } from "@cucumber/cucumber";

const baseUrl = process.env.BDD_BASE_URL ?? "http://app.localhost:8080";
const dashboardOrigin = process.env.BDD_DASHBOARD_ORIGIN ?? baseUrl;
const dashboardHostHeader =
  dashboardOrigin === baseUrl ? {} : { host: new URL(dashboardOrigin).host };

type OrganizationResponse = {
  id: string;
  members: Array<{ role: string; userId: string }>;
  slug: string;
};

type OrganizationListResponse = Array<{ slug: string }>;

type SignUpResponse = {
  message?: string;
  user?: { id: string };
};

let createdWorkspace: OrganizationResponse | undefined;
let existingWorkspace: OrganizationResponse | undefined;
let existingVisitor: Visitor | undefined;
let signUpStatus = 0;
let visitor: Visitor;
let workspaceStatus = 0;
let workspaceResponse: Response | undefined;
let authenticationStatuses: number[] = [];
let accountRequestStatus = 0;
let accountRequestMessage: string | undefined;
let existingAccountRequestStatus = 0;
let existingAccountRequestMessage: string | undefined;
let duplicateAccountResponse: Response | undefined;
let chunkedOversizedRequestStatus = 0;
let oversizedRequestStatus = 0;

type Visitor = {
  cookie?: string;
  email: string;
  handle: string;
  id?: string;
};

Given("a unique visitor who needs a workspace", () => {
  visitor = createVisitor();
});

Given("a second unique visitor who needs a workspace", () => {
  visitor = createVisitor();
});

Given("a visitor with an existing workspace", async () => {
  existingVisitor = createVisitor();
  await register(existingVisitor);
  existingWorkspace = await createWorkspace(existingVisitor, existingVisitor.handle);
  assert.equal(existingWorkspace.slug, existingVisitor.handle);
});

When("the visitor registers an account", async () => {
  await register(visitor);
});

When("the visitor registers an account and creates a workspace", async () => {
  await register(visitor);
  createdWorkspace = await createWorkspace(visitor, visitor.handle);
});

When("the visitor attempts to create a workspace with handle {string}", async (handle: string) => {
  workspaceResponse = await createWorkspaceResponse(visitor, handle);
  workspaceStatus = workspaceResponse.status;
});

When(
  "the second visitor registers an account and attempts the existing workspace handle",
  async () => {
    assert.ok(existingWorkspace, "An existing workspace is required.");
    await register(visitor);
    workspaceResponse = await createWorkspaceResponse(visitor, existingWorkspace.slug);
    workspaceStatus = workspaceResponse.status;
  },
);

When("the owner attempts to update the workspace handle to {string}", async (handle: string) => {
  assert.ok(existingVisitor, "An existing workspace owner is required.");
  assert.ok(existingWorkspace, "An existing workspace is required.");
  workspaceResponse = await fetch(`${baseUrl}/api/auth/organization/update`, {
    body: JSON.stringify({
      organizationId: existingWorkspace.id,
      data: { slug: handle },
    }),
    headers: requestHeaders(existingVisitor),
    method: "POST",
  });
  workspaceStatus = workspaceResponse.status;
});

When("the visitor makes repeated invalid sign-in attempts", async () => {
  authenticationStatuses = [];
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      body: JSON.stringify({
        email: visitor.email,
        password: "incorrect-password",
      }),
      headers: {
        "content-type": "application/json",
        origin: dashboardOrigin,
        ...dashboardHostHeader,
      },
      method: "POST",
    });
    authenticationStatuses.push(response.status);
  }
});

When("an unauthenticated visitor submits a request larger than 64 KiB", async () => {
  const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    body: JSON.stringify({
      email: "oversized@example.test",
      name: "a".repeat(65 * 1024),
      password: "correct-horse-battery-staple",
    }),
    headers: {
      "content-type": "application/json",
      origin: dashboardOrigin,
      ...dashboardHostHeader,
    },
    method: "POST",
  });
  oversizedRequestStatus = response.status;
  chunkedOversizedRequestStatus = await submitChunkedOversizedRequest();
});

When(
  "the visitor attempts account registration with a name longer than 120 characters",
  async () => {
    const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      body: JSON.stringify({
        email: visitor.email,
        name: "a".repeat(121),
        password: "correct-horse-battery-staple",
      }),
      headers: {
        "content-type": "application/json",
        origin: dashboardOrigin,
        ...dashboardHostHeader,
      },
      method: "POST",
    });
    const responseBody = (await response.json()) as { message?: string };
    if (visitor.id) {
      existingAccountRequestStatus = response.status;
      existingAccountRequestMessage = responseBody.message;
      return;
    }
    accountRequestStatus = response.status;
    accountRequestMessage = responseBody.message;
  },
);

When("the visitor attempts workspace creation with a name longer than 120 characters", async () => {
  workspaceResponse = await fetch(`${baseUrl}/api/workspaces`, {
    body: JSON.stringify({
      name: "a".repeat(121),
      slug: visitor.handle,
    }),
    headers: requestHeaders(visitor),
    method: "POST",
  });
  workspaceStatus = workspaceResponse.status;
});

When("the visitor attempts to register the same account again", async () => {
  duplicateAccountResponse = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    body: JSON.stringify({
      email: visitor.email,
      name: "Workspace Visitor",
      password: "correct-horse-battery-staple",
    }),
    headers: {
      "content-type": "application/json",
      origin: dashboardOrigin,
      ...dashboardHostHeader,
    },
    method: "POST",
  });
});

Then(
  "the workspace request is rejected with {string} and the visitor has no workspace",
  async (expectedMessage: string) => {
    assert.ok(workspaceStatus >= 400, `Expected a rejection, received ${workspaceStatus}.`);
    assert.ok(workspaceResponse, "A workspace response is required.");
    const error = (await workspaceResponse.json()) as { message?: string };
    assert.equal(error.message, expectedMessage);
    assert.deepEqual(await listWorkspaceSlugs(visitor), []);
  },
);

Then(
  "the workspace request is rejected with {string} and the existing workspace handle is unchanged",
  async (expectedMessage: string) => {
    assert.ok(workspaceStatus >= 400, `Expected a rejection, received ${workspaceStatus}.`);
    assert.ok(workspaceResponse, "A workspace response is required.");
    const error = (await workspaceResponse.json()) as { message?: string };
    assert.equal(error.message, expectedMessage);
    assert.ok(existingVisitor, "An existing workspace owner is required.");
    assert.ok(existingWorkspace, "An existing workspace is required.");
    assert.deepEqual(await listWorkspaceSlugs(existingVisitor), [existingWorkspace.slug]);
  },
);

Then(
  "authentication is rate limited and the visitor session contains no IP or user-agent",
  async () => {
    assert.deepEqual(authenticationStatuses.slice(0, 19), Array(19).fill(401));
    assert.equal(authenticationStatuses[19], 429);
    const response = await fetch(`${baseUrl}/api/auth/get-session`, {
      headers: requestHeaders(visitor),
    });
    assert.equal(response.status, 200);
    const session = (await response.json()) as {
      session?: { ipAddress?: string | null; userAgent?: string | null };
    };
    assert.equal(session.session?.ipAddress, null);
    assert.equal(session.session?.userAgent, null);
  },
);

Then("the request is rejected with 413 and the API remains ready", async () => {
  assert.equal(oversizedRequestStatus, 413);
  assert.equal(chunkedOversizedRequestStatus, 413);
  const response = await fetch(`${baseUrl}/api/ready`, { headers: dashboardHostHeader });
  assert.equal(response.status, 200);
});

function submitChunkedOversizedRequest(): Promise<number> {
  const url = new URL(`${baseUrl}/api/auth/sign-up/email`);
  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify({
      email: "chunked-oversized@example.test",
      name: "a".repeat(65 * 1024),
      password: "correct-horse-battery-staple",
    });
    const clientRequest = request(
      {
        headers: {
          "content-type": "application/json",
          origin: dashboardOrigin,
          ...dashboardHostHeader,
          "transfer-encoding": "chunked",
        },
        hostname: url.hostname,
        method: "POST",
        path: url.pathname,
        port: url.port,
      },
      (response) => {
        response.resume();
        response.on("end", () => resolve(response.statusCode ?? 0));
      },
    );
    clientRequest.on("error", reject);
    clientRequest.write(requestBody.slice(0, 1024));
    clientRequest.end(requestBody.slice(1024));
  });
}

Then("the account request is rejected with {string}", (expectedMessage: string) => {
  assert.equal(accountRequestStatus, 400);
  assert.equal(accountRequestMessage, expectedMessage);
});

Then(
  "invalid account registration has the same response for existing and unused email addresses",
  () => {
    assert.equal(existingAccountRequestStatus, accountRequestStatus);
    assert.equal(existingAccountRequestMessage, accountRequestMessage);
  },
);

Then("the duplicate account response is generic and does not create a session", async () => {
  assert.ok(duplicateAccountResponse, "A duplicate account response is required.");
  assert.equal(duplicateAccountResponse.status, 200);
  const response = (await duplicateAccountResponse.json()) as SignUpResponse;
  assert.ok(response.user, "The generic response should match a successful registration shape.");
  assert.equal(response.message, undefined);
  assert.equal(duplicateAccountResponse.headers.getSetCookie().length, 0);
});

function createVisitor(): Visitor {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  return {
    email: `visitor-${suffix}@example.test`,
    handle: `visitor-${suffix}`,
  };
}

async function register(currentVisitor: Visitor): Promise<void> {
  const signUpResponse = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    body: JSON.stringify({
      email: currentVisitor.email,
      name: "Workspace Visitor",
      password: "correct-horse-battery-staple",
    }),
    headers: {
      "content-type": "application/json",
      origin: dashboardOrigin,
      ...dashboardHostHeader,
    },
    method: "POST",
  });
  signUpStatus = signUpResponse.status;
  const signUp = (await signUpResponse.json()) as SignUpResponse;
  assert.ok(signUp.user, signUp.message ?? "Sign-up response did not contain a user.");
  currentVisitor.id = signUp.user.id;
  const signInResponse = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    body: JSON.stringify({
      email: currentVisitor.email,
      password: "correct-horse-battery-staple",
    }),
    headers: {
      "content-type": "application/json",
      origin: dashboardOrigin,
      ...dashboardHostHeader,
    },
    method: "POST",
  });
  assert.equal(signInResponse.status, 200);
  currentVisitor.cookie = signInResponse.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";", 1)[0])
    .join("; ");
  assert.ok(currentVisitor.cookie, "Sign-up response did not contain a session cookie.");
}

async function createWorkspace(
  currentVisitor: Visitor,
  handle: string,
): Promise<OrganizationResponse> {
  const response = await createWorkspaceResponse(currentVisitor, handle);
  assert.equal(response.status, 200);
  return (await response.json()) as OrganizationResponse;
}

async function createWorkspaceResponse(currentVisitor: Visitor, handle: string): Promise<Response> {
  return fetch(`${baseUrl}/api/workspaces`, {
    body: JSON.stringify({
      name: "Visitor Workspace",
      slug: handle,
    }),
    headers: requestHeaders(currentVisitor),
    method: "POST",
  });
}

function requestHeaders(currentVisitor: Visitor): Record<string, string> {
  assert.ok(currentVisitor.cookie, "A session cookie is required.");
  return {
    "content-type": "application/json",
    cookie: currentVisitor.cookie,
    origin: dashboardOrigin,
    ...dashboardHostHeader,
  };
}

async function listWorkspaceSlugs(currentVisitor: Visitor): Promise<string[]> {
  const response = await fetch(`${baseUrl}/api/auth/organization/list`, {
    headers: requestHeaders(currentVisitor),
  });
  assert.equal(response.status, 200);
  const organizations = (await response.json()) as OrganizationListResponse;
  return organizations.map((organization) => organization.slug);
}

Then("the workspace exists with the visitor as its owner", () => {
  assert.equal(signUpStatus, 200);
  assert.equal(createdWorkspace?.slug, visitor.handle);
  assert.equal(createdWorkspace?.members.length, 1);
  assert.deepEqual(
    createdWorkspace?.members.map(({ role, userId }) => ({ role, userId })),
    [{ role: "owner", userId: visitor.id }],
  );
});
