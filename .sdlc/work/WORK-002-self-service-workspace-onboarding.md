# WORK-002: Self-service workspace onboarding

## Source and status

Source: Juano approved this work item in Codex on 2026-08-21.

Status: in progress.

## Goal

Let a visitor create an account, create a first workspace, and arrive at its dashboard as the
workspace owner.

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

- A new visitor can create an account with an available handle and reaches that workspace's
  dashboard as owner.
- A signed-in user with no workspace can create one or retry after a failed creation.
- Invalid, reserved, or used handles result in a useful error and no unintended workspace.
- A returning user with a workspace sees the dashboard.
- Duplicate-email and sign-in failures remain understandable without exposing account details.

## Proposed approach

The React dashboard uses Better Auth's React client and organization client plugin. It calls the
existing same-origin Better Auth endpoints for sign-up, sign-in, session lookup, organization
listing, slug availability, and workspace creation. Server-side organization hooks enforce the
handle policy. Better Auth creates the membership with the static `owner` role. Workspace
creation keeps the active organization client-local because the current approved schema does not
persist Better Auth's optional `activeOrganizationId` session field.

Account registration and organization creation are separate calls. If organization creation
fails, the authenticated user remains on an onboarding screen that can retry safely. This avoids
custom authentication persistence and makes the partial-success state visible.

## Alternatives and tradeoffs

A bespoke Nest onboarding endpoint could coordinate the calls, but it would duplicate Better
Auth's session and organization authorization boundary. It was rejected for this slice. The
two-call approach cannot provide a database transaction across registration and organization
creation; the retry state is the deliberate recovery path.

## Consequential decisions

Juano approved the Better Auth browser client, a direct `better-auth@1.7.1` dependency in
`apps/web`, and the recoverable two-step onboarding flow on 2026-08-21.

## Risks and dependencies

The browser client depends on Better Auth's organization client plugin matching the configured
server plugin. The existing `organizationLimit` of three workspaces still applies. The exact
handle policy becomes a public URL contract and must be enforced server-side.

## TDD and BDD strategy

Start with a failing Playwright happy-path acceptance test. Add Gherkin coverage for the
same-origin auth and organization flow, PostgreSQL integration coverage for owner membership,
and focused UI tests for validation and recovery.

## Verification plan

Run format, lint, types, unit, integration, BDD, browser, coverage, Prisma validation,
Storybook, Compose configuration, Docker build, dependency audit, and public CI.

## Security and operations impact

The feature uses host-only same-origin cookies and does not persist raw IP addresses or raw
user-agent strings. No new service, secret, migration, or production resource is required.

## Migration and rollback

No migration is expected because Better Auth organization tables already exist. Roll back by
reverting the feature commits. Existing user and organization records remain valid.

## Agent roster and routing

One implementation worker owns the isolated feature worktree. Independent product, technical,
test, security, operations, and engineering-excellence reviewers inspect the final diff and
verification evidence before readiness.

## Approval

Approved by Juano on 2026-08-21.
