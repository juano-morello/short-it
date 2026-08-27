# Technical-debt backlog

## Purpose and ownership

This backlog records engineering liabilities in the v1 implementation. It excludes later product
features, provider selection, and risks that have no outstanding engineering action.

Juano owns priority and accepted tradeoffs. Delivery ownership is unassigned until a work item is
approved. Every item remains open unless its status says otherwise.

## Priority definitions

- **P0:** must be resolved before the stated production or scaling trigger.
- **P1:** must be resolved before expanding the affected behavior, trust boundary, or evidence
  claim.
- **P2:** maintainability work that can wait while the current behavior remains bounded and verified.

Priority describes the trigger, not an approved implementation sequence.

## TD-001: Shared admission and quota coordination

- Priority: P0 before public production traffic or more than one API instance.
- Status: open.
- Evidence: link publication, workspace creation, redirect DNS validation, analytics capture, and
  Better Auth rate limits contain process-local coordination. See the
  [operations record](../architecture/operations.md) and [threat model](threat-model.md).
- Risk: multiple API processes can enforce independent attempt windows or exceed intended shared
  capacity even when durable database counts remain correct.
- Exit criteria: an approved shared admission and quota design covers each affected path, preserves
  redirect-first behavior, and passes multi-instance concurrency and failure tests.

## TD-002: Retention-job scheduling and alerting

- Priority: P0 before production data is admitted.
- Status: open.
- Evidence: analytics and invitation prune commands exist, but the repository provisions no
  production scheduler or alerts.
- Risk: expired daily visitor digests or invitation email records can outlive their bounded cleanup
  grace, creating a retention breach.
- Exit criteria: an operator-owned schedule runs both production commands at least every five
  minutes and alerts on failures and missing success events according to the operations record.

## TD-003: Hosted observability and capacity evidence

- Priority: P0 before hosted rollout.
- Status: open.
- Evidence: the API emits privacy-safe structured outcomes, but the demo has no metrics backend,
  dashboard, alerting provider, or production load evidence.
- Risk: operators cannot enforce the documented redirect, lifecycle, database-saturation, and
  retention incident thresholds.
- Exit criteria: the selected environment exposes required metrics and alerts, and approved load
  tests define and meet connection-saturation, p95, p99, and 503 thresholds.

## TD-004: Backup and restore evidence

- Priority: P0 before hosted workspace or account deletion is enabled.
- Status: open.
- Evidence: deletion is irreversible and local Compose data is disposable. RPO 24 hours and RTO
  24 hours are intentions only.
- Risk: code rollback cannot recover deleted or corrupted data.
- Exit criteria: a named provider and operator own backups, a restore rehearsal meets the approved
  objectives, and the provider-specific recovery runbook records the evidence.

## TD-005: Production supply-chain and runtime hardening

- Priority: P0 before production release.
- Status: open.
- Evidence: dependencies and images are audited, but GitHub Actions use floating major tags and the
  project has no production image-scanning evidence. The threat model also requires a non-root
  production runtime.
- Risk: release inputs can change outside the reviewed lockfile and runtime boundaries.
- Exit criteria: actions are pinned immutably, production images are scanned under an approved
  policy, runtime identity is verified as non-root, and release evidence records the disposition.

## TD-006: Fresh reauthentication for destructive actions

- Priority: P1 before broad public account access or a stricter production security posture.
- Status: open as an accepted v1 demo risk.
- Evidence: workspace and account deletion require typed confirmation but do not require fresh
  password authentication.
- Risk: a compromised active session can perform irreversible deletion.
- Exit criteria: an approved reauthentication design protects both destructive actions and has
  browser, authorization, failure, and session-age coverage.

## TD-007: PostgreSQL row-level security evaluation

- Priority: P1 before treating database policy as a second tenant-isolation boundary.
- Status: open evaluation.
- Evidence: every organization-scoped application query is required to use a server-derived
  `organizationId`; PostgreSQL RLS was deliberately deferred.
- Risk: application scoping remains the only database tenant boundary.
- Exit criteria: an approved investigation records whether RLS is necessary, its Prisma and
  migration consequences, and either an implementation plan or a reasoned rejection.

## TD-008: Dashboard surface decomposition

- Priority: P2.
- Status: open.
- Evidence: `apps/web/src/App.tsx` owns session transitions, onboarding, dashboard routing, link
  publication, analytics, invitations, settings, and deletion presentation in one module.
- Risk: unrelated UI changes share a large stateful change surface and increase review and regression
  cost.
- Exit criteria: route and feature surfaces have cohesive module boundaries without changing the
  native History API contract, authorization behavior, or verified user flows.

## TD-009: Analytics prune production-image verification

- Priority: P0 before production data is admitted.
- Status: open.
- Evidence: the compiled analytics and invitation prune commands exist, but Quality smoke-tests only
  the invitation command in the production API image.
- Risk: an unverified analytics command can fail when a hosted scheduler invokes it, allowing
  expired visitor digests and aggregates to exceed their retention window.
- Exit criteria: Quality runs the compiled analytics prune command in the production API image
  against PostgreSQL and verifies a successful pruning outcome.

## TD-010: Continuous documentation integrity checks

- Priority: P2.
- Status: open.
- Evidence: WORK-013 validates delivery-record coverage, local Markdown targets, and identified stale
  claims with revision-specific assertions, but the repository has no committed validator in the
  Quality workflow.
- Risk: later documentation changes can introduce missing or duplicate delivery records, broken
  local links, or previously removed contradictions without failing CI.
- Exit criteria: a deterministic repository validator covers the maintained delivery and document
  invariants, demonstrates failure against representative mutations, and runs in Quality.

## TD-011: Complete web coverage source enumeration

- Priority: P1 before claiming an 80 percent threshold across all web product code.
- Status: open.
- Evidence: web coverage enforces 80 percent thresholds for modules loaded by the suite, but its
  configuration does not enumerate all `src` TypeScript and TSX files. The API configuration has an
  explicit source include.
- Risk: an unimported web source module can remain outside the coverage denominator, so a passing
  threshold does not prove coverage across every web product file.
- Exit criteria: the web coverage configuration explicitly includes all reviewed product-source
  patterns, records justified exclusions, and passes the policy thresholds.

## TD-012: Link-browsing profile absent from Quality

- Priority: P1 before treating FR-009's dedicated BDD profile as a current regression gate.
- Status: open.
- Evidence: WORK-010 delivered executable membership-scoped link-browsing scenarios, but the
  default BDD profile excludes them and Quality does not invoke `pnpm bdd:link-browsing`.
- Risk: Quality can pass without executing the dedicated FR-009 browsing scenarios, leaving only
  historical delivery evidence for that acceptance surface.
- Exit criteria: Quality invokes the dedicated link-browsing profile against the live stack and the
  authoritative command list includes it as an active gate.

## Related accepted risks

Distributed bot abuse, public redirect database admission, invitation forwarding, browser-side DNS
rebinding, and destructive action through a compromised session are accepted only for the documented
v1 demo boundaries. The threat model remains authoritative for ownership and mitigation triggers.
