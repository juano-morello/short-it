# WORK-007: Workspace and account deletion

## Source and status

Source: Juano approved this work item in Codex on 2026-08-22.

Status: in progress.

## Goal

Let an owner permanently delete a workspace and let a signed-in user permanently delete their
account after resolving every workspace they own.

## Requirement links

- FR-007: a workspace owner can irreversibly delete the workspace; an account can delete itself
  after resolving owned workspaces.
- NFR: organization-scoped access derives from the signed-in membership, never from browser
  tenant authority.

## Scope

- Add an owner-facing workspace deletion confirmation that requires the workspace handle.
- Use Better Auth's existing owner-authorized organization deletion operation for the workspace.
- Add an authenticated, trusted-origin account-deletion endpoint that requires the signed-in email
  as confirmation and rejects callers who still own a workspace.
- Delete the caller's user record only after the ownership check. Existing database cascades remove
  that user's sessions, credentials, and memberships; organization deletion cascades remove its
  links, invitations, and analytics.
- Send the dashboard to onboarding after workspace deletion and to the signed-out landing screen
  after account deletion.

## Non-goals

Ownership transfer, member removal, recovery windows, exports, restore tooling, fresh-password
reauthentication, new dependencies, schema migrations, and production backup changes are outside
this work item.

## Acceptance scenarios

- An owner who enters the exact workspace handle can delete that workspace and its scoped data.
- An editor, analyst, or owner of another workspace cannot delete it.
- A wrong workspace-handle confirmation performs no deletion.
- A signed-in user who owns a workspace cannot delete their account.
- A signed-in user who owns no workspace can confirm their email, delete their account, lose the
  session, and create no further authenticated requests.
- A wrong account-email confirmation performs no deletion.

## Proposed approach

Keep the organization deletion authority in Better Auth's static owner permission. The dashboard
requires a typed workspace handle before it calls that operation. A narrow NestJS account endpoint
derives the user from the session, checks owner memberships through Prisma, requires the matching
session email, and deletes the same user record. It never accepts a user ID from the browser.

## Alternatives and tradeoffs

Fresh-password reauthentication would better protect an already compromised session, but it would
add a new authentication flow outside launch scope. Typed confirmation protects against accidental
actions but does not provide fresh authentication. Better Auth already checks workspace deletion
authority; a second application-owned workspace deletion API would duplicate that boundary.

## Consequential decisions

Juano approved typed confirmation for launch: workspace handle for a workspace and signed-in email
for an account. Account deletion remains unavailable while any owned workspace exists. Ownership
transfer and recovery remain deferred.

## Risks and dependencies

Deletion is irreversible. Future hosted recovery depends on the deferred backup and restore
evidence. No dependency, Prisma migration, or production configuration change is expected.

## TDD and BDD strategy

Add executable lifecycle scenarios before implementation. Drive the account endpoint through
controller and PostgreSQL integration tests, then add dashboard unit and browser tests for typed
confirmation and post-deletion state.

## Verification plan

Run targeted lifecycle BDD, unit, PostgreSQL integration, dashboard tests, browser E2E, coverage,
formatting, lint, types, Prisma validation, builds, Compose, Docker, security audits, and the full
GitHub Quality workflow.

## Security and operations impact

The account endpoint needs the trusted dashboard origin and an authenticated session. It must log
only coarse deletion outcomes and request IDs, never email values. Workspace and account deletion
are permanent; backup restoration remains a production prerequisite rather than a launch feature.

## Migration and rollback

No migration. Code rollback cannot restore deleted data; recovery is limited to future hosted
backups.

## Agent roster and routing

The primary agent owns the shared deletion boundary. Independent requirements, test, operations,
technical, security, and engineering-excellence reviewers inspect the final diff and evidence.
There are no parallel write agents because workspace and account deletion share authorization and
data-lifecycle behavior.

## Approval

Approved by Juano in Codex on 2026-08-22.
