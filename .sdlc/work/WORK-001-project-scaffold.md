# WORK-001: Establish short.it product foundation

## Source and status

Source: Juano's 2026-08-21 product discovery. Status: delivered in scaffold commit `fbbc0bc`;
subsequent product slices completed the v1 local demo.

## Goal

Create a public, portable foundation for a self-service workspace link shortener without
deploying production infrastructure.

## Requirement links

FR-001 through FR-008.

## Scope and non-goals

Scope includes the monorepo, auth seam, Prisma schema, initial dashboard, Docker topology,
CI, SDLC records, and verified local probes. It excludes a production host, DNS, managed
database account, domain setup, image registry, and product CRUD implementation.

## Acceptance scenarios

- A contributor can install the workspace and build both applications.
- A local edge router separates `app.localhost` from future workspace hosts.
- Health and readiness are externally observable.
- Better Auth mounts safely in NestJS.
- The project records the first feature's privacy, tenancy, and operational constraints.

## Proposed approach

Use the architecture in ADR-0001 through ADR-0003 and capture all direct dependency
provenance in dependency reviews.

## Alternatives and tradeoffs

Single-framework backend, Vercel coupling, and direct Next.js route handlers were rejected
because the approved scope calls for a dedicated NestJS backend and portable Docker images.

## Consequential decisions

All architecture decisions are captured in ADR-0001 through ADR-0003. Production remains
deferred.

## Risks and dependencies

Auth schema compatibility, direct dependency supply chain, Docker base images, and future
wildcard DNS remain the primary risks.

## TDD and BDD strategy

The project used outside-in TDD. BDD began with an executable probe feature, and subsequent product
slices added self-service browser scenarios and dedicated acceptance profiles. The current coverage
and active gates are recorded in the [test strategy](../quality/test-strategy.md).

## Verification plan

Run the manifest commands locally, run CI after the initial push, and perform independent
product, technical, test, security, operations, and excellence reviews.

## Security and operations impact

See the threat model and operations record. No production secrets or external credentials are
stored in the repository.

## Migration and rollback

No production migration exists. Prisma schema validation and future migration rehearsal are
required before a deployed feature.

## Agent roster and routing

- Requirements reviewer: product acceptance and scope traceability.
- Technical reviewer: application boundaries, correctness, and compatibility.
- Test reviewer: TDD, BDD, coverage, and verification evidence.
- Security reviewer: auth, tenancy, dependencies, secrets, and redirect abuse risks.
- Operations reviewer: containers, health, recovery, and deployment posture.
- Excellence reviewer: repository clarity, cohesion, and maintainability.

## Approval

Juano approved product scope, engineering architecture, repository location, public GitHub
visibility, MIT license, and scaffold execution on 2026-08-21. Production deployment remains
explicitly deferred.
