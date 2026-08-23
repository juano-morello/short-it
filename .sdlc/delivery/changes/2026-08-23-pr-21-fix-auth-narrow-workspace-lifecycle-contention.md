# PR 21: fix(auth): narrow workspace lifecycle contention

- PR: https://github.com/juano-morello/short-it/pull/21
- Merge commit: `a17c82068c9c0cdcdc35e7a7f69fe515a1e493e4`
- Merged: 2026-08-23T18:24:04Z

## Delivered scope

FR-007's workspace lifecycle boundary now uses short `READ COMMITTED` transactions that first acquire a parameterized `SELECT ... FOR UPDATE` lock on the session-derived `User` row. Workspace creation and account deletion therefore serialize per user while unrelated users can proceed independently.

The change preserves session-derived authority, the three-workspace limit, ownerless-workspace prevention, trusted-origin checks, typed account-email confirmation, and privacy-safe lifecycle logs. It also recognizes adapter-wrapped PostgreSQL SQLSTATE `40001` errors as a bounded retry fallback.

Native Better Auth member-role update, leave, and member-removal routes are unavailable while ownership and membership mutation remain out of scope. This closes races that could otherwise bypass the lifecycle lock and leave an organization without an owner.

## Decision and tradeoff

The prior broad `SERIALIZABLE` transaction policy caused avoidable cross-user serialization failures during seven-worker onboarding. The approved per-user lock boundary retains the required same-user ordering without globally serializing independent users. No schema migration, dependency change, or infrastructure addition was introduced. Rejecting Better Auth's native member-role update, leave, and member-removal routes is an intentional externally observable compatibility change: clients to those routes now receive `404` while ownership and membership mutation remain unsupported.

## Verification

Evidence class: proven by merged implementation and automated verification. Before the change, the seven-worker browser suite exposed PostgreSQL SQLSTATE `40001` as an adapter-wrapped lifecycle failure, while serial execution passed. After the change, the final local run passed 219 API unit tests, 15 PostgreSQL integration tests, and 89.35% API statement coverage. The lifecycle BDD feature passed 10 scenarios and 40 steps. Standard E2E passed 14 tests with seven workers, and the one-worker diagnostic control passed the same 14 tests. The delivery run observed no remaining lifecycle transient error or retry exhaustion.

Formatting, linting, type checking, Prisma validation, application and Storybook builds, Compose validation, Docker builds, production-image prune smoke, and dependency audits passed. Independent product, technical, test, security, operations, and engineering-excellence reviews found no code-level blocker.

## Operations and follow-up

Before hosted rollout, run a hot same-user burst beside seven independent onboardings using the selected production pool and replica configuration. Define and meet connection-saturation, p95 and p99 lifecycle-latency, and 503 thresholds; block rollout if any threshold is exceeded. Ensure ingress or APM telemetry exposes request latency, lock waits, and connection saturation before relying on the lifecycle incident runbook. Deploy one API version at a time or prove the same lifecycle and route-rejection behavior during a mixed-version rollout. Confirm that no supported client depends on the rejected native member-mutation routes. Reverting their rejection without an equivalent owner-invariant protection would reintroduce the ownerless-workspace risk.

Authoritative project records: `.sdlc/work/WORK-012-concurrent-workspace-lifecycle-contention.md`, `.sdlc/architecture/operations.md`, `.sdlc/quality/threat-model.md`, and `.sdlc/quality/test-strategy.md`.
