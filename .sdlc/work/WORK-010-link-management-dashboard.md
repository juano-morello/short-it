# WORK-010: Link management dashboard

## Source and status

Source: Juano approved this work item in Codex on 2026-08-22.

Status: delivered in PR #18 on 2026-08-23.

## Goal

Give every workspace member a browseable link directory and split the dashboard into route-backed
Links, Analytics, and Settings sections. Local public URLs must point to the configured workspace
host, including its port.

## Requirement links

- FR-003: a workspace can create an HTTP or HTTPS link with a server-generated CUID slug.
- FR-006: owner, editor, and analyst permissions restrict workspace behavior.
- FR-009: workspace members can browse published links in a routed dashboard.
- NFR: organization-scoped reads and writes use a server-derived membership scope.

## Scope

- Add an authenticated `GET /api/links` endpoint that requires workspace membership and returns the
  newest published links first.
- Return pages of 50 links with an opaque link-ID cursor when another page is available.
- Let owners, editors, and analysts browse their workspace links. Owners and editors retain the
  existing publication capability. Analysts remain read-only.
- Render clickable and copyable local public URLs in the form
  `http://<workspace>.localhost:8080/<cuid>` when the dashboard runs on
  `http://app.localhost:8080`.
- Split the signed-in dashboard into `/links`, `/analytics`, and `/settings`, with browser
  back/forward support through the native History API.
- Move invitations and destructive account or workspace actions to Settings without changing their
  server-side authorization rules.

## Non-goals

Link editing, deletion, filtering, search, sorting controls, per-link analytics, workspace
switching, vanity slugs, schema migrations, new dependencies, production routing changes, and
deployment are outside this work item. WORK-009 remains reserved for deferred production work.

## Acceptance scenarios

- A signed-in owner, editor, or analyst can browse only published links from a workspace where
  they hold membership.
- An analyst can see immutable destinations and public URLs but cannot publish a link.
- An owner or editor publishes a link from Links and sees it in the directory immediately.
- The directory presents a working local workspace-host URL with the dashboard port retained.
- A member can navigate directly to Links, Analytics, or Settings and use browser back and forward
  between those sections.
- A page returns at most 50 links and exposes a cursor only when a further page exists.

## Proposed approach

Extend the existing `LinksService` rather than introducing a second link ownership boundary. The
service resolves the caller's membership with the requested workspace and uses the returned
organization ID in the Prisma query. The cursor is only pagination context. It cannot grant access
to another workspace.

The React application keeps its existing session state and adds a small native route state layer.
It does not add a client router dependency. The public URL builder derives the tenant hostname and
port from the active dashboard origin, replacing the `app.` host label with the workspace handle.

## Alternatives and tradeoffs

React Router would provide a larger routing abstraction, but this three-route dashboard does not
need another runtime dependency. A native History API layer keeps the bundle and supply-chain scope
unchanged.

The directory shows target URLs to analysts. Juano approved that read-only visibility so analysts
can browse the workspace's links. Server-side publication authorization remains unchanged.

## Consequential decisions

Juano approved FR-009 and WORK-010 so the deferred production WORK-009 identifier is not reused.
Juano also approved read-only link browsing for analysts, cursor pagination at 50 links, and the
Links, Analytics, Settings information architecture. No schema, dependency, or production
infrastructure decision is introduced.

## Risks and dependencies

Destination URLs are visible to every member, including analysts. Membership remains the only
authorization source for the list endpoint. The local URL builder depends on the existing Caddy
host convention, where `app.localhost:8080` and `<workspace>.localhost:8080` share a port.

## TDD and BDD strategy

Start with link-read authorization, tenant-scoped service paging, controller delegation, and
dashboard route tests. Extend the existing Gherkin link feature with an analyst browsing scenario.
Run browser coverage for the route-backed dashboard and local public URLs. The browsing scenario
uses its own BDD profile because the default profile already reaches the single-process sign-up cap.

## Verification plan

Run focused and full unit tests, BDD, browser E2E, type checks, formatting, lint, builds, Prisma
validation, Compose validation, dependency security checks, and the GitHub Quality workflow.
Coverage remains at least 80 percent. Independent requirements, technical, test, security,
operations, and engineering-excellence reviews are required before PR readiness.

## Security and operations impact

The list endpoint is authenticated but does not require a trusted Origin because it is read-only.
The service scopes every link query with the organization ID from the authenticated membership.
No analytics data, raw IP address, raw user-agent value, secret, or new operational dependency is
added.

## Migration and rollback

No migration is required. Reverting the application code removes the list endpoint and routed
dashboard while leaving existing links and redirect behavior unchanged.

## Agent roster and routing

The primary agent owns the shared API and dashboard contract. Independent requirements, technical,
test, security, operations, and engineering-excellence reviewers inspect the final diff and
verification evidence before PR readiness.

## Approval

Juano approved the scope, analyst destination visibility, browse UI, route structure, cursor
pagination, and WORK-010 identifier in Codex on 2026-08-22.
