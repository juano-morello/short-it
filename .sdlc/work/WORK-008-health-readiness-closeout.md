# WORK-008: Health and readiness closeout

## Source and status

Source: Juano approved V1 closeout work in Codex on 2026-08-22.

Status: in progress.

## Goal

Verify the existing unauthenticated API health and PostgreSQL readiness probes, record FR-008 as
delivered, and preserve the portable V1 demo boundary.

## Requirement links

- FR-008: the API exposes unauthenticated `/api/health` and `/api/ready` probes.

## Scope

- Assert both probes return HTTP 200 and their documented JSON projections on the dashboard host.
- Retain the readiness database check and existing unit coverage.
- Update the requirement and delivery record after successful verification.

## Non-goals

Provider selection, provisioning, deployment, DNS, TLS, managed databases, observability services,
new dependencies, schema changes, public API expansion, and application behavior changes are out of
scope.

## Acceptance scenarios

- An unauthenticated dashboard-host request to `/api/health` returns 200 and the process identity.
- An unauthenticated dashboard-host request to `/api/ready` returns 200 only after PostgreSQL
  responds, with the ready database projection.

## Proposed approach

Strengthen the existing executable Gherkin probe scenario with explicit status assertions. The
controller already returns the approved projections and the readiness route already queries
PostgreSQL, so no runtime implementation change is expected.

## Alternatives and tradeoffs

Adding deployment-specific checks would exceed the portable demo boundary. Retaining the existing
minimal probes verifies orchestration semantics without choosing production infrastructure.

## Consequential decisions

Juano deferred productionization. No hosting, infrastructure, security-posture, persistence, or
public-contract decision is introduced.

## Risks and dependencies

The live BDD scenario requires the existing Compose stack and PostgreSQL. A failed readiness query
continues to be surfaced by the framework as unavailable; this work does not define a new failure
payload.

## TDD and BDD strategy

The implementation predates this closeout. Extend the existing outside-in health feature to assert
HTTP status, then run the live scenario and controller unit tests. No artificial code change is
needed if the strengthened acceptance test passes against the existing contract.

## Verification plan

Run the health BDD scenario, controller unit tests, formatting, lint, type checks, unit,
integration, browser, coverage, Prisma validation, builds, Compose validation, security checks, and
the published Quality workflow.

## Security and operations impact

The probes remain unauthenticated only on the dashboard host. Readiness verifies PostgreSQL but
does not depend on analytics persistence. No new telemetry or infrastructure is added.

## Migration and rollback

No migration. Reverting this documentation and test-only slice returns the prior verification
coverage without affecting runtime behavior.

## Agent roster and routing

The primary agent owns the shared contract and evidence. A balanced independent reviewer roster
will cover requirements, technical correctness, tests, security, operations, and engineering
excellence before PR readiness; no write-capable delegate is needed for this narrow slice.

## Approval

Approved by Juano in Codex on 2026-08-22 as the non-production V1 closeout.
