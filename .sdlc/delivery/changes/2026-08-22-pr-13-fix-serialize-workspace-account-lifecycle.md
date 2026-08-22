# PR 13: fix: serialize workspace account lifecycle

- PR: https://github.com/juano-morello/short-it/pull/13
- Merge commit: `5f3bda2aa985a23c25bb0337204e9ee6b0840de6`
- Merged: 2026-08-22T22:24:13Z

## Delivered scope

FR-007 is delivered. A workspace owner can permanently delete the workspace after typing its exact
handle, and a signed-in user can permanently delete the account after typing the session email and
resolving every workspace they own.

Workspace creation now writes the organization and its initial owner membership in one serializable
transaction. Account deletion runs its ownership check and user deletion in a separate serializable
transaction with the same lifecycle policy. This prevents concurrent creation and account deletion
from leaving an ownerless workspace.

## Decisions and safeguards

Better Auth retains the static owner-authorized workspace-deletion operation. The application owns
only workspace creation and blocks Better Auth's native organization-create route. Transaction
retries are bounded for serialization conflicts and positively identified transaction timeouts;
exhaustion returns a retryable `503` and emits only request ID, outcome, and attempt count.

Workspace creation has a per-user in-process rate limit. No dependency, schema migration,
ownership transfer, recovery window, password reauthentication, deployment, or backup change was
introduced.

## Verification

Evidence class: proven by the merged implementation and GitHub Quality workflow. The workflow
passed formatting, lint, type checks, unit and PostgreSQL integration tests, coverage, Prisma
validation, application and Storybook builds, Compose and Docker validation, dependency security
checks, all BDD profiles including the workspace lifecycle race, and browser E2E. Independent
requirements, technical, test, security, operations, and engineering-excellence reviews had no
remaining actionable findings.

## Security, operations, and follow-up

Deletion telemetry remains privacy-safe and excludes account, workspace, IP-address, and user-agent
values. Deletion is irreversible; tested backup and restore evidence remains a prerequisite before
hosted production use. Future ownership transfer, recovery, and fresh-password reauthentication
remain out of scope.

Authoritative project records: `.sdlc/work/WORK-007-workspace-account-deletion.md`,
`.sdlc/architecture/operations.md`, `.sdlc/quality/threat-model.md`, and
`.sdlc/quality/test-strategy.md`.
