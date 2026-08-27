# WORK-009: Production web-image routing

## Source and status

Source: deferred production follow-up recorded by WORK-010 and PR 18, bounded during WORK-013.

Status: planned. Juano approved this scope placeholder on 2026-08-26 but has not approved
implementation or deployment.

## Goal

Make the production web image serve the v1 dashboard entry point and every supported native dashboard
route without weakening static-asset handling or tenant-host isolation.

## Requirement links

- FR-009: workspace members can use the routed Links, Analytics, and Settings dashboard.
- NFR: host-only dashboard cookies must not be sent to user-controlled workspace hosts.
- Assumption: `app.<domain>` routes the dashboard and API while `<workspace>.<domain>` remains
  redirect-only.

## Scope

- Serve the dashboard entry point at `/`, `/links`, `/analytics`, and `/settings` from the production
  web image.
- Return the built `index.html` only for supported dashboard navigation and browser refreshes.
- Serve existing static assets with correct content types and cache policy.
- Return a real not-found response for missing static assets instead of the SPA document.
- Preserve `/api/*` routing to the API and redirect-only behavior on workspace hosts.
- Add production-image and edge-routing verification for direct navigation and refreshes.

## Non-goals

Provider selection, deployment, DNS, TLS, custom domains, a new client router, new dashboard routes,
application behavior, API contracts, and tenant-host routing changes are outside this work item.

## Acceptance scenarios

- An authenticated member can open or refresh `/links`, `/analytics`, and `/settings` on the
  dashboard host through the production images.
- The dashboard host serves built assets with their correct content types.
- A missing asset returns not found and does not return `index.html`.
- A workspace host still exposes only valid public CUID redirect paths and never serves the
  dashboard fallback.
- `/api/*` on the dashboard host continues to reach the API.

## Proposed approach

Add an explicit production Caddy configuration to the web image with bounded SPA fallback and static
file serving. Verify the web image behind the edge image rather than relying on Vite's development
fallback. Keep the current native History API router and existing host topology.

The implementation approach requires confirmation during refinement because the eventual production
topology may combine or separate edge and static-file responsibilities.

## Alternatives and tradeoffs

An application server or client-router dependency could own navigation fallback, but either would
expand runtime or dependency scope without changing the current three-route requirement. A
provider-specific rewrite rule would be smaller but would couple verified behavior to a provider
before provider selection.

## Consequential decisions

This placeholder preserves portable image behavior and the approved dashboard and tenant-host split.
It does not decide whether one or two Caddy instances run in production. That topology remains a
separate Juano-owned production decision.

## Risks and dependencies

An unrestricted fallback can return HTML for missing JavaScript or stylesheet assets. Applying a
dashboard fallback to workspace hosts can expose the application surface and dashboard cookie path
outside the trusted host. Tests must cover both failure modes.

The work requires the existing web build and Caddy images but no approved new dependency.

## TDD and BDD strategy

Start with failing production-image requests for each supported dashboard route, a missing asset, an
API request, and a tenant-host path. Implement the smallest Caddy configuration that satisfies those
boundaries. Existing browser flows remain regression coverage.

## Verification plan

Run focused production-image routing checks and the full repository Quality workflow, including
Docker builds, Compose validation, BDD, and browser E2E. Require product, technical, test, security,
operations, and engineering-excellence review before readiness.

## Security and operations impact

The host split is a security boundary. The work must not send dashboard content or cookies to a
workspace host. Cache policy must not make authenticated application documents publicly reusable.
The final production topology and log policy require separate approval.

## Migration and rollback

No data migration is expected. Roll back the web or edge image configuration to the last verified
image if supported routes, assets, API routing, or tenant isolation regress.

## Agent roster and routing

Assign one implementation owner after refinement. Independent product, technical, test, security,
operations, and engineering-excellence reviewers inspect the final diff and verification evidence.

## Approval

Juano approved the bounded backlog definition on 2026-08-26. Implementation, production topology,
provider selection, and deployment remain unapproved.
