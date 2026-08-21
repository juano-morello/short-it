import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Given, Then, When } from "@cucumber/cucumber";

const baseUrl = process.env.BDD_BASE_URL ?? "http://app.localhost:8080";

type OrganizationResponse = {
  members: Array<{ role: string; userId: string }>;
  slug: string;
};

type SignUpResponse = {
  message?: string;
  user?: { id: string };
};

let createdWorkspace: OrganizationResponse | undefined;
let signUpStatus = 0;
let visitor: { email: string; handle: string; id?: string };
let workspaceStatus = 0;

Given("a unique visitor who needs a workspace", () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  visitor = {
    email: `visitor-${suffix}@example.test`,
    handle: `visitor-${suffix}`,
  };
});

When("the visitor registers an account and creates a workspace", async () => {
  const signUpResponse = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    body: JSON.stringify({
      email: visitor.email,
      name: "Workspace Visitor",
      password: "correct-horse-battery-staple",
    }),
    headers: {
      "content-type": "application/json",
      origin: baseUrl,
    },
    method: "POST",
  });
  signUpStatus = signUpResponse.status;
  const signUp = (await signUpResponse.json()) as SignUpResponse;
  assert.ok(signUp.user, signUp.message ?? "Sign-up response did not contain a user.");
  visitor.id = signUp.user.id;
  const sessionCookie = signUpResponse.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";", 1)[0])
    .join("; ");

  const workspaceResponse = await fetch(`${baseUrl}/api/auth/organization/create`, {
    body: JSON.stringify({
      keepCurrentActiveOrganization: true,
      name: "Visitor Workspace",
      slug: visitor.handle,
    }),
    headers: {
      "content-type": "application/json",
      cookie: sessionCookie,
      origin: baseUrl,
    },
    method: "POST",
  });
  workspaceStatus = workspaceResponse.status;
  createdWorkspace = (await workspaceResponse.json()) as OrganizationResponse;
});

Then("the workspace exists with the visitor as its owner", () => {
  assert.equal(signUpStatus, 200);
  assert.equal(workspaceStatus, 200);
  assert.equal(createdWorkspace?.slug, visitor.handle);
  assert.equal(createdWorkspace?.members.length, 1);
  assert.deepEqual(
    createdWorkspace?.members.map(({ role, userId }) => ({ role, userId })),
    [{ role: "owner", userId: visitor.id }],
  );
});
