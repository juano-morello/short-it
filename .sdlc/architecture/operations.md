# Operations

## Environments and ownership

Local Compose is the only runnable environment in this scaffold. Juano owns production
deployment and provider selection decisions. A future deployment should use US East and a
managed PostgreSQL service.

Docker build contexts exclude local dependency trees, generated output, test artifacts, Git
metadata, and environment files through `.dockerignore`. This preserves reproducible image
dependency installation and keeps developer secrets out of image contexts.

The Caddy edge rejects bodies larger than 64 KiB for `/api/*` and overwrites `X-Real-IP` from the
direct client connection. Better Auth uses that header for its in-memory rate-limit key while
session persistence clears the IP and user-agent fields. A production proxy chain must either
leave Caddy as the public edge or replace this rule with an equivalent trusted-header policy.

For public redirects, Caddy separately overwrites `X-Shortit-Client-IP`. Analytics derives its
ephemeral daily digest only from that header. Do not forward this header from an upstream client or
use `X-Forwarded-For` as an analytics identity source. The launch country value is `Unknown`.
Before production country enrichment, authenticate the edge that supplies a new country value and
document the source separately.

## Logs, metrics, and traces

The API must emit structured, privacy-safe logs with request IDs. It must not log raw IPs,
raw user agents, session tokens, invitation URLs, or destination query strings. Product
metrics include redirect success and failure and analytics-write failures. Link publication logs a
request ID, DNS-resolution outcome, and latency. Public redirects log a request ID, outcome, status,
and latency. Neither path logs a hostname, slug, destination, query, cookie, IP address, or user
agent. Treat five
`redirect_destination_resolution` `unavailable` or `capacity-exhausted` outcomes in five minutes
as a resolver incident: confirm API readiness, compare the outcome rate with successful redirects,
check the configured resolver, and roll back the redirect route if the 503 rate persists. The demo
has no metrics backend, dashboard, or alert. Before production, the selected observability provider
must chart `link_destination_resolution` and `redirect_destination_resolution` outcomes and latency
and alert on that five-in-five-minute threshold.

## Health and readiness

`GET /api/health` reports process health. `GET /api/ready` checks PostgreSQL reachability.
Orchestration should route only ready API instances. Redirect availability must not depend on
the analytics writer succeeding.

## Service-level objectives

Initial product expectation: a valid redirect remains available when telemetry fails.
Concrete latency, availability, and error-budget targets require production traffic evidence
and are deferred.

## Alerts and dashboards

Before production, alert on readiness failures, redirect error ratio, analytics write failure
ratio, and database connection saturation. These alerts and dashboards require provider
selection and are deferred.

## Capacity and cost

No provider or paid resource is provisioned. The demo runs Better Auth's in-memory limiter, so
each API process maintains its own counters. Link publication also keeps its approved 30-attempt
member/workspace window and quota check/write coordination in process; its published-link count is
durable PostgreSQL state. The service serializes quota checks and writes for each workspace, but
that coordination applies only to one API process. Shared limiter and quota coordination must be
in place before running more than one API instance.

Public redirects have an independent ten-request DNS validation gate with a two-second timeout.
That gate protects outbound resolution but does not admit or rate-limit database lookups. An edge
or WAF admission policy, or a shared redirect limiter, is required before public production traffic
or multiple API instances.

Redirect analytics use a separate PostgreSQL pool capped at two connections and an in-process
20-capture gate. Capture runs only after a successful `GET` response ends; `HEAD` redirects do not
count. Per link and UTC day, no more than 100 distinct referrer hosts are retained, with further
hosts grouped as `other`. Before production, the production operator must run
`pnpm --filter @short-it/api analytics:prune` at least every five minutes, alert on any
`redirect_analytics_prune_failed` event, and alert if no
`redirect_analytics_pruned` event arrives for ten minutes. A failed prune is a retention breach:
the operator must restore a successful run before the five-minute cleanup grace elapses. This
schedule is required to physically remove expired daily visitor digests; expiry metadata alone does
not delete rows.

Workspace invitations use opaque capabilities and retain an invited email while pending only. The
application deletes accepted and cancelled invitations immediately. Before production, the operator
must run `node apps/api/dist/auth/prune-invitations.js` in the production API image at least every
five minutes and alert on a failed run or no successful run for ten minutes. An overdue invitation
prune is a retention breach.

Workspace and account deletion are irreversible application actions. Code rollback cannot recover
their records. Before production, the selected provider must supply tested backup and restore
evidence before users are offered deletion in a hosted environment.

## Migrations and rollback

Prisma migrations must run before an API image that relies on them. Migrations are additive
where possible. Roll back an application image before attempting destructive data reversal;
restore data only from a verified provider backup.

## Recovery objectives

Target RPO is 24 hours and target RTO is 24 hours. These are intentions until a production
backup and restore runbook is tested.

## Runbooks and incident response

For redirect errors, verify edge host routing, API readiness, and destination policy. For a
database incident, stop writes, assess last backup, and follow the eventual provider restore
procedure. Do not use raw analytics data for incident diagnosis.
