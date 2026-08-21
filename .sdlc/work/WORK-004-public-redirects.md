# WORK-004: Public workspace redirects

## Source and status

Source: Juano approved this work item in Codex on 2026-08-21.

Status: in progress.

## Goal

Resolve a published CUID link from a public workspace host and redirect the visitor to its immutable
destination without exposing dashboard or authentication surfaces on that host.

## Requirement links

- FR-004: a public workspace host resolves a slug and redirects to its immutable destination.
- NFR: all organization-scoped reads use a server-derived `organizationId` scope.
- NFR: redirect availability takes precedence over analytics persistence.
- NFR: URLs reject localhost, private-network, and non-web targets at redirect time.

## Scope

- Accept only `GET` and `HEAD` requests to `/<cuid>` on one valid workspace label beneath the
  configured base domain.
- Parse and validate the direct host authority in the API. The browser's `Host`, forwarded-host
  headers, query parameters, and cookies do not authorize a workspace.
- Resolve the workspace handle to an organization ID, then resolve a published link by the existing
  composite `organizationId` and slug key.
- Revalidate the stored destination immediately before emitting the redirect. The redirect resolver
  uses an independent two-second, ten-concurrent-request capacity budget and only coalesces
  simultaneous checks for the same hostname.
- Return `302` with `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, and the immutable
  stored destination. Short-link query parameters are ignored.
- Keep tenant hosts redirect-only. Dashboard, Better Auth, `/api/*`, health, extra path segments,
  and unsupported methods remain unavailable on them.

## Non-goals

Analytics collection, click persistence, referrer/country/device enrichment, caching destination
DNS across requests, list/edit/delete link UI, vanity slugs, customer domains, invitations, and
production deployment are outside this work item. WORK-005 owns analytics behavior.

## Acceptance scenarios

- A public workspace host redirects a published CUID to its stored destination with the approved
  status and response headers.
- The same CUID on another workspace host, an unpublished link, an unknown handle, and an unknown
  CUID all return the same 404 response without a `Location` header.
- Tenant `/api/*`, authentication, dashboard, nested paths, and unsupported methods do not become
  reachable through the redirect route.
- A destination that resolves privately or permanently fails resolution at redirect time does not
  redirect and returns 404. Transient DNS failure and resolver capacity exhaustion return 503 with
  `Retry-After` and no `Location` header.
- A tenant-host request neither requires a dashboard session nor stores or logs raw IP address,
  raw user-agent, cookies, destination query values, or the workspace host.

## Proposed approach

Add a public redirect controller and service that are separate from the authenticated publication
service. The controller validates the host and CUID, asks the service for the scoped published link,
and writes the public redirect response. Caddy forwards only the approved tenant-host requests to
that controller; the API repeats host validation as the authority boundary.

Refactor the destination-address classifier so publication and redirect checks have separate
capacity gates. Redirect checks repeat DNS resolution on every request and never fetch or proxy the
destination. In-flight checks for the same hostname may share one resolution result but no result is
retained after it settles.

## Alternatives and tradeoffs

Permanent or cacheable redirects would reduce repeated validation and future analytics visibility,
so they are not used. A persistent DNS cache would weaken the approved per-redirect revalidation
contract. A browser interstitial or a destination proxy could address more DNS-rebinding cases, but
would materially change the product and is excluded.

## Consequential decisions

Juano approved `302` redirects with `Cache-Control: no-store` and `Referrer-Policy: no-referrer`.
Incoming query parameters are ignored. Unknown, unpublished, malformed, cross-workspace, and
permanently unsafe targets share a generic 404. Transient DNS failure or redirect resolver capacity
exhaustion returns retryable 503 with `Retry-After`.

The configured base domain accepts exactly one validated workspace handle before it. `app` remains
the dashboard host and all other special, apex, nested, malformed, and foreign hosts remain 404.
The local contract is `<workspace>.localhost`; production requires an explicit configured base
domain.

Juano accepted the residual browser-side DNS-rebinding risk. Server-side revalidation reduces but
cannot prevent a visitor resolver from receiving a different answer. Manual abuse takedown may set
`publishedAt` to `null`, which returns generic 404.

## Risks and dependencies

Public redirect traffic is unauthenticated, so its resolver capacity must not consume the
publication budget. PostgreSQL remains the availability dependency for redirect lookup. No schema
migration is expected because the existing organization slug and composite link key support the
query. Caddy host routing and API host validation must ship together; rollback restores the current
tenant-host 404 behavior without changing published rows.

## TDD and BDD strategy

Start with Caddy-level Gherkin for a manual public redirect, then add host parser, CUID parser,
tenant-scoped lookup, resolver outcome, and response-header unit tests. Add PostgreSQL integration
coverage for identical CUIDs across workspaces and unpublished links. Browser coverage verifies
that a tenant-host redirect does not receive dashboard cookies.

## Verification plan

Run format, lint, types, unit, integration, redirect BDD, browser, coverage, Prisma validation,
Storybook, Compose configuration, Docker build, dependency audit, and public CI. Coverage remains
at least 80 percent. Independent product, technical, test, security, operations, and
engineering-excellence reviews are required before readiness.

## Security and operations impact

Redirect logs use only a request ID, coarse outcome, status, and latency. They do not contain a
host, slug, destination, query, referrer, IP address, user agent, session, or cookie. Future
observability must track DNS-unavailable and resolver-capacity outcomes. Analytics remain outside
the redirect critical path, so no analytics failure can prevent a redirect.

## Migration and rollback

No migration is expected. Roll back the API controller and Caddy tenant route together to restore
404 responses on tenant hosts. Published links stay intact for a later retry.

## Agent roster and routing

Product, security, technical, test, and operations reviewers performed independent refinement.
The implementation uses the isolated `codex/work-004-public-redirects` worktree. The same review
disciplines plus engineering-excellence review inspect the completed diff and evidence.

## Approval

Approved by Juano in Codex on 2026-08-21.
