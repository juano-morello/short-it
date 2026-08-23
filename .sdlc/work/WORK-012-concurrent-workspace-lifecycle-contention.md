# WORK-012: Narrow workspace lifecycle contention

## Source and status

Source: delegated Codex intake on 2026-08-22. The standard seven-worker browser suite reports
PostgreSQL SQLSTATE `40001` failures while concurrent workspace onboarding runs; serial browser
execution passes. The current generic lifecycle retry classifier does not recognize the
adapter-wrapped `40001` form. CSS remediation is tracked independently in PR #20 and is not a
dependency or source of changes for this work item.

Status: refined as a bugfix and awaiting Juano's design approval. Plan mode is not active in this
task, so this document is the equivalent approval brief.

## Goal

Eliminate unnecessary cross-user contention during concurrent workspace onboarding while preserving
the FR-007 guarantee that concurrent workspace creation and account deletion cannot leave an
ownerless workspace.

## Requirement links

- FR-001: a signed-in user can create a workspace.
- FR-007: account deletion is unavailable while the account owns a workspace; a concurrent
  create/delete pair commits either an owned workspace or a deleted account.
- NFR: organization-scoped operations continue to derive authority from the authenticated session,
  never a browser-provided organization identifier.
- NFR: lifecycle logs and audit logs do not persist or emit email addresses, workspace handles,
  raw IP addresses, or raw user-agent strings.

## Scope

- Establish the root cause with the current lifecycle transaction implementation and a PostgreSQL
  regression harness.
- Replace the broad `SERIALIZABLE` lifecycle policy with short `READ COMMITTED` transactions.
- At the start of both application-owned workspace creation and account deletion, lock the same
  authenticated `User` row with parameterized `SELECT ... FOR UPDATE` before membership reads or
  writes.
- Preserve the current creation limit, session-derived identity, trusted-origin checks, native
  Better Auth create-route rejection, typed account-email confirmation, owner-role evaluation, and
  privacy-safe lifecycle logging.
- Make transaction error classification recognize the adapter-wrapped PostgreSQL `40001` shape as a
  defensive fallback. This is not the primary remediation and must not be the only behavior change.
- Add deterministic unit, PostgreSQL integration, BDD, and seven-worker browser regression
  coverage for independent-user progress and same-user lifecycle serialization.

## Non-goals

- Changing Better Auth roles, session handling, workspace deletion authority, quotas, public API
  shape, database schema, or Prisma and PostgreSQL dependency versions.
- Introducing a table lock, advisory lock, queue, distributed coordination service, ownership
  transfer, recovery window, or production infrastructure.
- Cherry-picking, modifying, or depending on CSS PR #20. If it merges before implementation, the
  implementer must re-check the current classifier and retain this work item's independent
  concurrency regression evidence.

## Acceptance scenarios

- Given seven distinct authenticated users without workspaces, when they create distinct valid
  workspaces concurrently through the normal browser flow, then every request succeeds, every
  workspace has exactly one owner membership for its session-derived user, and no response exposes
  a PostgreSQL serialization failure or lifecycle retry exhaustion.
- Given independent authenticated users creating workspaces concurrently, when their transactions
  overlap at the membership read/write boundary, then their distinct user-row locks do not block
  one another and the PostgreSQL regression harness records no `40001` failure.
- Given one authenticated user has fewer than the maximum workspaces, when two create requests for
  that user race, then their user-row lock serializes the membership count and writes, and the
  committed total never exceeds three.
- Given a user without a workspace, when workspace creation and account deletion race, then exactly
  one result occurs: creation succeeds with its owner membership and deletion returns the existing
  ownership conflict, or deletion succeeds and creation returns the existing session-derived
  unauthorized result. No ownerless organization is committed.
- Given a user who owns any workspace, when they confirm account deletion with their session email,
  then deletion remains rejected and the account remains. Given a user who owns none, matching
  confirmation still deletes only the session-derived user and its cascading records.
- Given an untrusted origin, missing session, mismatched email confirmation, invalid workspace
  input, or a browser-provided tenant identifier, when either lifecycle endpoint is called, then
  its existing authorization and validation outcome is unchanged.
- Given a lifecycle database error is wrapped by the PostgreSQL adapter and carries SQLSTATE
  `40001`, when it reaches the retry boundary, then it is classified as retryable without logging
  its raw database payload or any personal or workspace identifier. A non-retriable database error
  remains visible as a failure and is not retried.

Applicable executable BDD feature: `apps/api/features/workspace-lifecycle.feature`. It will retain
the create/delete invariant and gain an explicit independent-user concurrent onboarding scenario if
the browser suite alone cannot make that behavior deterministic.

## Proposed approach

The current lifecycle helper opens every workspace-creation and account-deletion operation at
`SERIALIZABLE`. Workspace creation reads `Member` rows for the maximum-workspace check, then writes
an `Organization` and `Member`; account deletion reads the same user's memberships, then deletes
the `User`. PostgreSQL serializable snapshot isolation correctly aborts a transaction when its
concurrent read/write dependency graph cannot be serialized. The seven-worker symptom, serial
success control, shared broad transaction policy, and membership read-before-write pattern identify
that policy as the contention source. The missed adapter-wrapped `40001` turns an expected retryable
database abort into a leaked request failure, but retrying alone leaves the broad conflict surface.

Use one short interactive transaction per operation at `READ COMMITTED`. Its first database action
will select the session-derived `User.id` with a parameterized `FOR UPDATE` row lock. A missing row
returns the existing unauthorized outcome. Only after the lock succeeds may the operation read
memberships, enforce the maximum-workspace or ownerless-workspace rule, and write the organization,
membership, or user deletion. All lifecycle paths acquire that one user row first and never acquire
a second user row, which supplies a consistent lock order.

This creates the required per-user serialization boundary without serializing unrelated users:

```text
different users:  lock User A  ||  lock User B  -> proceed independently
same user:        lock User A  -> membership decision/write -> commit
                  lock User A  -> observes committed result -> correct losing outcome
```

At PostgreSQL `READ COMMITTED`, each command sees committed data as it begins. A `FOR UPDATE` waiter
blocks on the same row, then locks the updated row or returns no row if it was deleted. Thus a
post-lock membership read sees a just-committed owner membership, and a post-lock create sees a
deleted user. This is the narrow invariant boundary that FR-007 needs. The raw lock query must use
Prisma's parameterized raw-query API only; the user ID comes from the server-side session and is
never a browser-controlled tenant selector.

The bounded transaction error handling remains for genuine transient failures and will be extended
only after a shape-specific test captures the adapter wrapper. Its logs remain limited to request
ID, outcome, and attempt count. No migration is expected.

## Alternatives and tradeoffs

1. Keep `SERIALIZABLE` and only classify/retry adapter-wrapped `40001` errors. This masks the
   immediate error shape but preserves unnecessary independent-user aborts, adds tail latency, and
   can still exhaust the retry budget. Rejected.
2. Use `READ COMMITTED` plus a `User` row lock. This gives the required same-user ordering and
   independent-user concurrency with a short, comprehensible critical section. Proposed, subject to
   design approval.
3. Lock `Member` rows or the `Member` table. Empty membership sets cannot be protected by row locks,
   while a table lock recreates global contention. Rejected.
4. Use transaction-scoped advisory locks keyed by user ID. This can work but adds a second locking
   mechanism, collision/key-derivation design, and database-specific operational behavior when the
   authoritative `User` row already provides the needed coordination point. Rejected.
5. Enforce the lifecycle rule with a schema constraint or trigger. The rule spans a user deletion,
   membership roles, and a maximum count. A trigger-based design would broaden persistence policy
   and is not justified before the narrow application transaction is evaluated. Rejected.

## Consequential decisions

Juano's approval is required before implementation because this changes the database transaction
policy that protects an irreversible lifecycle invariant. The requested decision is:

- Approve `READ COMMITTED` lifecycle transactions that first acquire a parameterized `FOR UPDATE`
  lock on the session-derived `User` row in both workspace creation and account deletion, replacing
  their shared broad `SERIALIZABLE` policy.

No schema, dependency, public-contract, security-boundary, deployment, or production-infrastructure
decision is requested.

## Risks and dependencies

- Same-user requests will wait briefly rather than abort. The critical section must stay limited to
  local database reads and writes, with no network calls, so the existing five-second transaction
  timeout remains a safe operational bound.
- Explicit locking can deadlock if later work adds another inconsistent lock order. This slice locks
  exactly one user row first in both paths; tests and code review must preserve that rule.
- A raw SQL lock query can introduce injection or authorization risk if written unsafely. Require a
  parameterized query and session-derived ID, with a security review of the exact call site.
- The existing test-only read barrier assumes both serializable operations reach a post-read point.
  It would deadlock under intended same-user blocking and must be replaced by lock-aware,
  deterministic coordination rather than timing-based retries.
- PR #20 may change the classifier independently. Rebase only after approval, compare the resulting
  behavior, and keep the root-cause and concurrency tests in this work item.
- Existing PostgreSQL and Prisma behavior is a dependency. PostgreSQL documents that serializable
  transactions can roll back with serialization failures, that `READ COMMITTED` takes a fresh
  statement snapshot, and that competing `FOR UPDATE` locks on one row wait and then return the
  changed row or no row after deletion.

## TDD and BDD strategy

1. Preserve a failing seven-distinct-user PostgreSQL regression that overlaps creation after the
   membership read and shows the current serializable failure or retry-exhaustion path. Capture the
   adapter-wrapped `40001` shape from that run for a focused classifier test.
2. Add unit tests first for lock acquisition before membership access, missing-user behavior, the
   maximum-workspace race, parameterized query use, and the exact retry classifier boundary.
3. Replace the current same-user post-read barrier with lock-aware PostgreSQL integration tests:
   create/delete must produce only the two approved outcomes; create/create must not exceed three;
   independent users must all commit without a serialization retry.
4. Extend the lifecycle Gherkin feature for observable cross-user onboarding progress if needed,
   without weakening the existing create/delete scenario.
5. Run the browser suite explicitly at seven workers and serially against fresh local Compose
   stacks. The seven-worker run is the regression proof; serial execution is a diagnostic control,
   not the acceptance substitute.

## Verification plan

- Observe the intended red regression before implementation and keep it as the highest-value
  regression evidence.
- Run focused lifecycle unit tests and PostgreSQL integration tests, including repeated deterministic
  same-user and independent-user races.
- Run `pnpm bdd:workspace-lifecycle` and the normal BDD profiles affected by auth and onboarding.
- Run `pnpm --filter @short-it/e2e exec playwright test --workers=7` against a fresh Compose stack,
  followed by the one-worker diagnostic control.
- Run all required repository gates: formatting, lint, typecheck, unit, integration, BDD, E2E,
  coverage at or above 80 percent, Prisma validation, Storybook build, Compose validation, Docker
  build, and production plus full dependency audit.
- Independently review product, technical, test, security, operations, and engineering-excellence
  evidence before a PR can be ready for review.

## Security and operations impact

No new network surface, dependency, secret, schema, or persistent data is proposed. Authorization
continues to use the authenticated session's user ID; trusted-origin checks remain at both endpoint
boundaries; no browser-provided organization ID participates in lifecycle authority. The raw lock
query must be parameterized and must not log SQL or values. Existing lifecycle and deletion audit
events remain privacy-safe and contain no email, workspace, IP, or user-agent data.

Operationally, a sustained increase in lock waits or retry exhaustion should retain the existing
privacy-safe `workspace_lifecycle_transaction` monitoring. The delivery report must compare
seven-worker results before and after the change and document any remaining transient error class.

## Migration and rollback

No Prisma migration or data backfill is expected. Roll back by reverting the application commit if
lock-wait latency, unexpected deadlocks, or invariant failures appear. This rollback changes future
transaction behavior only; it cannot restore accounts or workspaces already deleted, so rollout
evidence must include the irreversible-operation acceptance scenarios before any hosted release.

## Agent roster and routing

Refinement is complete in this isolated worktree. After approval, use one write owner and independent
read-only gates; no parallel writers should touch the coupled lifecycle boundary.

| Role | Model and effort | Responsibility and rationale |
|---|---|---|
| Lifecycle implementer | GPT-5.6 Terra, high | Owns `apps/api/src/auth` lifecycle code and its focused tests in one isolated worktree. The transaction boundary is coupled and needs one writer. |
| Product compliance reviewer | GPT-5.6 Terra, high | Checks FR-001 and FR-007 acceptance outcomes without widening scope. |
| Technical correctness reviewer | GPT-5.6 Sol, high | Independently verifies PostgreSQL isolation, lock ordering, lifecycle outcomes, and Prisma adapter behavior. |
| Test reviewer | GPT-5.6 Terra, high | Reviews red evidence, deterministic race design, worker-level regression coverage, and flake risk. |
| Security reviewer | GPT-5.6 Sol, xhigh | Reviews parameterized raw SQL, session-derived authority, trusted origins, and privacy-safe logs. |
| Operations and excellence reviewers | GPT-5.6 Terra, high; GPT-5.6 Sol, high | Review lock-wait telemetry, rollback, resource impact, cohesion, and repository conventions. |

## Approval

Awaiting Juano's explicit approval of the transaction-policy decision above. No implementation may
begin before that approval.
