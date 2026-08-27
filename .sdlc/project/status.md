# Project status

Updated: 2026-08-26.

## Current milestone

The short.it v1 local demo is feature-complete against FR-001 through FR-009. The repository includes
the application behavior, executable acceptance coverage, portable Docker images, local Compose
routing, and engineering records needed to evaluate the product locally.

The project is not deployed and is not production-ready. There is no hosted environment, production
domain, managed PostgreSQL provider, image registry, backup evidence, production observability, or
operator-owned retention schedule. The product brief's live-demo success criterion remains unmet
until an approved hosted rollout makes the application available to its intended audience.

## Delivered v1 behavior

- A visitor can register, sign in, create a workspace, and return to its dashboard.
- Owners can invite editors and analysts with copyable invitation links.
- Owners and editors can publish immutable HTTP or HTTPS destinations with server-generated CUID
  slugs. All workspace members can browse the published link directory.
- Public workspace hosts resolve links without exposing dashboard routes or cookies.
- Redirect analytics report clicks, daily unique visitors, time series, normalized referrer hosts,
  country, and coarse device category without persisting raw IP addresses or raw user-agent strings.
- Owners can delete a workspace. A user can delete their account after deleting every workspace they
  own.
- Health and PostgreSQL readiness probes support local orchestration.

The detailed acceptance evidence and status for each requirement remain in `requirements.md`.

## Deliberate v1 limits

- Slugs are server-generated CUIDs. Vanity slugs are later product scope.
- Destinations are immutable after publication. A different destination requires a new link.
- Invitations are copyable capabilities. V1 has no outbound email or verified-email integration.
- Ownership transfer, leaving a workspace, member removal, and role mutation are unavailable.
- Country analytics remain `Unknown` until a production edge provides an authenticated country
  signal.
- Rate limits and several capacity gates coordinate within one API process only.
- Local Compose uses disposable development data and development routing.

## Quality disposition

The merge at PR 22 passed the repository Quality workflow, including formatting, lint, type checks,
unit and PostgreSQL integration tests, coverage, Prisma validation, Storybook, Docker and Compose
builds, dependency audits, executable Gherkin profiles, and the Playwright browser suite. The
repository coverage policy remains at least 80 percent for product code.

Future changes must produce fresh verification. Historical merge evidence is recorded under
`.sdlc/delivery/changes/` and does not replace verification of a new revision.

## Next decision

Juano owns the next product decision:

- approve production-readiness refinement and hosted rollout work; or
- approve a later product milestone such as v1.1 before hosting.

The roadmap classifies those options. The technical-debt backlog tracks engineering liabilities
without turning them into product commitments.

## Authoritative links

- Product intent: `product-brief.md`
- Requirements and acceptance status: `requirements.md`
- Product and production roadmap: `roadmap.md`
- Architecture: `../architecture/overview.md`
- Operations and hosted-rollout conditions: `../architecture/operations.md`
- Technical debt: `../quality/technical-debt.md`
- Accepted security risks: `../quality/threat-model.md`
