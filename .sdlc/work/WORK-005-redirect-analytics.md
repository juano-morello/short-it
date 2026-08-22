# WORK-005: Privacy-preserving redirect analytics

## Source and status

Source: Juano approved this work item in Codex on 2026-08-22.

Status: in progress.

## Goal

Record useful aggregate signals for successful public redirects without delaying or changing a
redirect when analytics storage, enrichment, or capacity is unavailable.

## Requirement links

- FR-005: redirect analytics record clicks, daily unique visitors, referrer host, country, and
  device category.
- NFR: redirect availability takes precedence over analytics persistence.
- NFR: raw IP addresses and raw user-agent strings are never persisted or logged.
- NFR: daily visitor identifiers expire within 24 hours and aggregates expire after 12 months.

## Scope

- Add a Prisma migration for per-link daily totals, daily unique-visitor state, and aggregate
  country, device-category, and referrer-host dimensions.
- Derive a keyed daily visitor digest from an edge-normalized IP only in memory. Store the digest
  with an expiry of less than 24 hours; do not persist the source IP.
- Derive a coarse device category from the request user-agent in memory. Normalize an HTTP(S)
  referrer to its hostname only; do not persist a raw referrer URL.
- Record `Unknown` country in local development. Production may accept country only from a
  trusted edge-normalized source after the edge authenticates that source.
- Run capture after the redirect response is committed. A separate in-process gate permits at most
  20 concurrent captures and drops excess telemetry with a privacy-safe outcome log.
- Add an authenticated organization-scoped analytics overview for owner, editor, and analyst
  members. The dashboard shows available link totals and daily trends without separate link CRUD.
- Add an idempotent aggregate and visitor-state pruning command. Production scheduling remains a
  deployment prerequisite.

## Non-goals

Raw event logs, cross-day visitor tracking, lifetime unique-person claims, geolocation databases,
browser-provided country headers, third-party analytics, customer-facing exports, dashboards for
unauthenticated visitors, custom roles, and production scheduler or edge provisioning are outside
this work item.

## Acceptance scenarios

- A valid public redirect returns its approved `302` and headers even when analytics persistence
  fails or the analytics gate is saturated.
- A successful redirect eventually increments its link's daily click count and only increments its
  daily unique-visitor count once for the same keyed visitor digest and day.
- Stored analytics contain no raw IP, raw user-agent, raw referrer URL, destination URL, cookie, or
  session value. Local capture records `Unknown` country.
- An authorized owner, editor, or analyst can view only their workspace's analytics. A different
  workspace or non-member receives no analytics data.
- The prune command removes expired visitor state and aggregates older than 12 months.

## Proposed approach

Keep public redirect resolution as the critical path. After a safe destination is resolved and the
response has ended, submit a capture task to a distinct bounded analytics gate. The task derives
only allowed values, upserts daily aggregates, and records a unique visitor through a scoped
database key. Failures and drops are logged as request ID, coarse outcome, status, and latency.

The authenticated analytics service derives organization access from session membership and scopes
each Prisma query by the server-derived organization ID. A small dashboard gateway reads the
overview and renders totals and daily trends for the current workspace.

## Consequential decisions

Juano approved a new Prisma migration, a dedicated `ANALYTICS_VISITOR_SECRET`, an in-process
20-concurrent-capture limit that drops telemetry under pressure, and 12-month aggregate retention.
Development does not perform live GeoIP lookup and records `Unknown`; tests inject deterministic
country classification. Production country classification requires a trusted edge source and does
not trust browser headers.

## Risks and dependencies

Analytics are intentionally approximate during persistence failures or saturation. A process-local
capture gate does not coordinate across API instances, so a shared limiter or queue is required
before multi-instance production. The prune command must be scheduled by the future deployment.
The visitor secret is required in production and must remain independent from authentication
secrets. No new dependency is proposed.

## TDD and BDD strategy

Begin with a public redirect scenario that remains a `302` when capture fails. Add focused policy
tests for digest lifecycle, device and referrer normalization, trusted country classification, and
capture saturation. Add PostgreSQL integration tests for scoped aggregation, deduplication, and
pruning. Add browser coverage for the analytics overview and analyst read access.

## Verification plan

Run format, lint, types, unit, integration, BDD, browser, coverage, Prisma validation, Storybook,
Compose configuration, Docker build, dependency audit, and public CI. Coverage remains at least 80
percent. Independent product, technical, test, security, operations, and engineering-excellence
reviews are required before readiness.

## Migration and rollback

The migration adds analytics tables only. Roll back application code before removing any data.
Retain aggregate rows until the approved prune policy removes them.

## Approval

Juano approved this scope and tradeoffs in Codex on 2026-08-22.
