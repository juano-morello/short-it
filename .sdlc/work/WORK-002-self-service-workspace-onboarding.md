# WORK-002: Self-service workspace onboarding

## Source and status

Source: Juano approved this work item in Codex on 2026-08-21.

Status: delivered.

## Goal

Let a visitor create an account, sign in, create a first workspace, and arrive at its dashboard as
the workspace owner.

## Requirement links

- FR-001: self-registration and workspace creation.
- NFR: organization-scoped data must use a server-derived organization ID.
- NFR: dashboard cookies remain host-only on `app.<domain>`.
- NFR: dashboard controls meet baseline keyboard and semantic HTML accessibility.

## Scope

- Account sign-up and sign-in screens.
- Workspace name and handle collection after account registration.
- Better Auth organization creation with the creator as `owner`.
- Session-aware dashboard and retryable onboarding state.
- Handle validation for 3 to 30 lowercase letters, digits, and internal hyphens.
- Reserved handles: `app`, `api`, and `www`.

## Non-goals

Invitations, workspace switching, link management, redirects, analytics, password recovery,
email verification, customer domains, schema changes, and production deployment are out of
scope.

## Acceptance scenarios

- A new visitor can create an account, sign in, create a workspace with an available handle, and
  reach that workspace's dashboard as owner.
- A signed-in user with no workspace can create one or retry after a failed creation.
- Invalid, reserved, or used handles result in a useful error and no unintended workspace.
- A returning user with a workspace sees the dashboard.
- Duplicate-email and sign-in failures remain understandable without exposing account details.

## Proposed approach

The React dashboard uses Better Auth's React client and organization client plugin for sign-up,
sign-in, session lookup, and organization listing. Workspace creation now uses the application-owned
lifecycle endpoint delivered after this slice. That endpoint enforces the handle policy and creates
the organization and static `owner` membership in one database transaction. Active-organization
selection remains client-local and is reconstructed from the organization listing; the approved
schema does not persist Better Auth's optional `activeOrganizationId` session field. Native Better
Auth organization creation is rejected.

Account registration and workspace creation remain separate. The browser explicitly signs in after
registration because automatic sign-in is disabled to return generic duplicate-account responses.
If workspace creation fails, the authenticated user remains on an onboarding screen that can retry
safely. The transaction rolls back the organization and membership together, so the superseded
orphan-cleanup procedure is no longer required.

## Alternatives and tradeoffs

This slice originally rejected an application-owned Nest onboarding endpoint and used Better Auth's
separate browser operations with operator cleanup for partial organization creation. WORK-007 and
WORK-012 later established application-owned lifecycle transactions and concurrency invariants.
The delivered endpoint keeps Better Auth as the session authority while providing an atomic
organization-and-owner-membership boundary.

## Consequential decisions

Juano approved the Better Auth browser client, a direct `better-auth@1.7.1` dependency in
`apps/web`, and the original recoverable three-operation onboarding flow on 2026-08-21. Later
approved lifecycle work superseded only the workspace-creation portion with the transactional
application endpoint described above.

## Risks and dependencies

The browser client depends on Better Auth's organization client plugin matching the configured
server plugin. The application-owned maximum of three workspaces is enforced by a membership count
inside the lifecycle transaction. The exact handle policy is a public URL contract and remains
enforced server-side. Workspace creation relies on the application transaction and same-user
lifecycle lock documented by the later lifecycle work.

## TDD and BDD strategy

Start with a failing Playwright happy-path acceptance test. Add Gherkin coverage for the
same-origin auth and organization flow, PostgreSQL integration coverage for owner membership,
and focused UI tests for validation and recovery.

## Verification plan

Run format, lint, types, unit, integration, BDD, browser, coverage, Prisma validation,
Storybook, Compose configuration, Docker build, dependency audit, and public CI.

## Security and operations impact

The feature uses host-only same-origin cookies and does not persist raw IP addresses or raw
user-agent strings. Caddy sets a trusted ephemeral client-IP header for Better Auth's in-memory
rate limiter and rejects API request bodies larger than 64 KiB. Registration validates account
names before duplicate-email handling and returns the same sign-in transition for both successful
and generic duplicate responses. No new service, secret, migration, or production resource is
required.

## Migration and rollback

No migration is expected because Better Auth organization tables already exist. Roll back by
reverting the feature commits. Existing user and organization records remain valid.

## Agent roster and routing

One implementation worker owns the isolated feature worktree. Independent product, technical,
test, security, operations, and engineering-excellence reviewers inspect the final diff and
verification evidence before readiness.

## Resolved follow-up

The application now owns authentication and workspace integration in
`apps/web/src/workspace-gateway.ts`. The presentation component calls that gateway instead of the
Better Auth client directly. No remaining action is attached to this follow-up.

## Approval

Approved by Juano on 2026-08-21.
