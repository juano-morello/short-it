# Requirements

## Functional

| ID | Requirement | Acceptance evidence | Status |
|---|---|---|---|
| FR-001 | Anyone can self-register and create a workspace. | Browser scenario and Better Auth organization BDD integration. | delivered |
| FR-002 | A workspace owner can invite editor and analyst members using a copyable invitation link. | Role and invitation BDD scenarios. | planned |
| FR-003 | A workspace can create an HTTP or HTTPS link with a server-generated CUID slug. Vanity slugs are planned for v1.1. | API contract, validation, and browser scenario. | delivered |
| FR-004 | A public workspace host resolves a slug and redirects to its immutable destination. | Redirect integration and resilience tests. | delivered |
| FR-005 | Redirect analytics record clicks, daily unique visitors, referrer host, country, and device category. | Aggregation integration tests. | in progress |
| FR-006 | Owner, editor, and analyst permissions restrict workspace behavior. | Cross-tenant and authorization tests. | planned |
| FR-007 | A workspace owner can irreversibly delete the workspace; an account can delete itself after resolving owned workspaces. | Lifecycle BDD scenarios. | planned |
| FR-008 | The API exposes unauthenticated `/api/health` and `/api/ready` probes. | Unit and BDD probe tests. | scaffolded |

## Nonfunctional

- Redirect-first: analytics persistence failures must not block a valid redirect.
- Aggregate analytics retention is 12 months. The per-day visitor identifier expires within
  24 hours.
- The dashboard labels daily uniqueness precisely and does not claim a lifetime unique-person
  count.
- URLs accept HTTP or HTTPS only and reject localhost, private network, and non-web targets.
- Host-only dashboard cookies must not be sent to user-controlled workspace hosts.
- All organization-scoped reads and writes include a server-derived `organizationId` scope.
- Target code coverage is at least 80 percent, except explicitly reviewed generated code.
- Dashboard components meet baseline keyboard and semantic HTML accessibility expectations.
- Intended recovery objectives, once hosted, are RPO 24 hours and RTO 24 hours.

## Assumptions

- A future configured base domain can route `app.<domain>` to the dashboard/API and
  `<workspace>.<domain>` to redirect-only handling.
- A managed PostgreSQL service will be selected before production use.
- Manual database intervention is acceptable for early abuse handling.

## Open questions

- What operational quota values should apply after the first self-service slice?
- Which provider will own backups and recovery evidence in production?

## Deferred decisions

- Production deployment provider and region, with US East as the preferred location.
- Customer-owned domains, billing, abuse automation, and outbound invitation email delivery.
- PostgreSQL row-level security as a defense-in-depth layer after application tenant scoping
  is proven.
