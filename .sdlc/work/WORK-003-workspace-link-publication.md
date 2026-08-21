# WORK-003: Workspace link publication

## Source and status

Source: Juano approved this work item in Codex on 2026-08-21.

Status: complete. Merged in PR #2 on 2026-08-21.

## Goal

Let an owner or editor publish an immutable HTTP or HTTPS destination for a workspace. The
service generates the public CUID slug and records publication immediately.

## Requirement links

- FR-003: a workspace can create an HTTP or HTTPS link with a server-generated CUID slug.
- FR-006: workspace roles restrict link behavior.
- NFR: organization-scoped writes use a server-derived organization ID.
- NFR: URLs reject localhost, private-network, and non-web targets.

## Scope

- `POST /api/links` accepts a destination URL and a requested workspace ID.
- The API accepts writes only from a configured dashboard origin, resolves the session, verifies
  membership for that workspace, and uses the membership record's `organizationId` for the write.
- Owners and editors can publish. Analysts and non-members receive no publish capability.
- Prisma generates a CUID for `Link.slug`; creation sets `publishedAt`.
- Destination validation accepts only HTTP and HTTPS, rejects credentials, and rejects
  unresolvable, loopback, private, link-local, carrier-grade NAT, multicast, and otherwise
  reserved addresses.
- The dashboard exposes a destination-only publication form and confirms the generated slug.
- An application-owned workspace gateway wraps Better Auth calls. A link gateway owns the
  browser-side representation of the application API call; it is not a shared package boundary.

## Non-goals

Redirect host resolution, analytics, listing, deletion, link editing, workspace switching,
invitations, custom domains, and production deployment are out of scope. Vanity slugs are a
v1.1 follow-up and are not part of launch scope.

## Acceptance scenarios

- A signed-in owner can publish a valid destination and receives an immediately published link
  with a CUID slug for that workspace.
- An editor can publish a valid destination.
- An analyst, a member of another workspace, and a cross-origin request cannot publish a link.
- Non-HTTP(S), credential-bearing, unresolvable, and private or reserved destinations are
  rejected without creating a link.
- The dashboard has no slug input and displays the generated workspace/slug path after success.

## Proposed approach

Keep the existing `Link` table and make its slug a Prisma-generated CUID. The Nest controller
uses the Better Auth session from the request and delegates authorization and persistence to a
link service. The service looks up the membership using both the session user ID and the requested
workspace ID. It writes only with the returned membership's organization ID.

The destination policy parses the URL, validates its scheme and credentials, then resolves all
addresses and rejects unsafe results. The redirect slice must repeat destination resolution before
redirecting to reduce DNS-rebinding exposure.

The React presentation component calls narrow workspace and link gateways rather than Better Auth
or `fetch` directly.

## Alternatives and tradeoffs

Browser-generated slugs would weaken the product contract and invite collision and naming-policy
work before launch. CUID generation in Prisma uses the existing client and needs no dependency or
database migration. Vanity slugs remain deferred until their public contract, collision behavior,
and moderation needs are approved.

Resolving destinations during creation blocks a link when DNS is unavailable. That is the accepted
security tradeoff for this release. Redirect handling still requires its own resolution and
revalidation.

## Consequential decisions

Juano approved immediate publication and server-generated CUID slugs on 2026-08-21. Vanity slugs
are deferred to v1.1 and excluded from launch scope. This work adds the internal `POST /api/links`
contract but does not expose a third-party API.

Juano also approved launch guardrails on 2026-08-21: an authorized member may make 30 publication
attempts for a workspace in ten minutes, each workspace may hold 1,000 published links, and a
destination URL may contain at most 2,048 characters.

## Risks and dependencies

DNS answers can change after a link is created. WORK-004 must resolve and revalidate the
destination on the redirect path. Publication bounds DNS resolution to ten concurrent requests and
two seconds, returning a retryable 503 for transient resolver failures. It logs a request ID,
outcome, and latency without recording a hostname or destination. Local acceptance tests use a
public IP literal where external DNS is unavailable; unit tests cover hostname resolution through an
injected resolver. The publication attempt window and quota check/write coordination use
in-memory state in the single-instance demo; the published-link count is durable PostgreSQL state.
A production multi-instance deployment must replace the process-local controls with equivalent
shared limiter and quota coordination.

## TDD and BDD strategy

Start with executable Gherkin for owner publication and unsafe destination rejection. Add focused
unit tests for address policy and role policy, PostgreSQL integration coverage for CUID generation
and cross-workspace denial, a dashboard test for CUID confirmation, and a Playwright owner flow.

## Verification plan

Run format, lint, types, unit, integration, BDD, browser, coverage, Prisma validation and schema
diff, Storybook, Compose configuration, Docker build, dependency audit, and public CI. Coverage
must remain at least 80 percent.

## Security and operations impact

The browser does not authorize workspace access. The API derives the write scope from a session and
membership record. No raw IP address, user-agent, session value, or destination query string is
stored or logged. The service makes DNS availability part of publication validation. Redirect
availability and redirect-time revalidation remain work for WORK-004. The service rejects the
31st authorized publication attempt in a ten-minute member/workspace window, rejects a workspace's
1,001st link, and rejects destination URLs longer than 2,048 characters before resolving or
persisting them.

## Migration and rollback

No database migration is expected. Prisma's client-side CUID default populates the existing
non-null `Link.slug` column. Roll back by reverting the feature commits. Published link rows remain
in the database and can be served again if the feature is restored; no destructive data rollback is
planned.

## Agent roster and routing

One implementation worker owns the isolated worktree. Independent product, technical, test,
security, operations, and engineering-excellence reviewers inspect the final diff and verification
evidence before readiness.

## Approval

Approved by Juano in Codex on 2026-08-21.
