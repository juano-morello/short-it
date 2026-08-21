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

## Logs, metrics, and traces

The API must emit structured, privacy-safe logs with request IDs. It must not log raw IPs,
raw user agents, session tokens, invitation URLs, or destination query strings. Product
metrics include redirect success and failure and analytics-write failures. Link publication logs
a request ID, DNS-resolution outcome, and latency without logging the hostname or destination.
Treat five `unavailable` outcomes in five minutes as a resolver incident: confirm API readiness,
compare the resolver-outcome log rate with successful publication, check the configured resolver,
and temporarily roll back the publication API if the 503 rate persists. The demo has no metrics
backend, dashboard, or alert. Before production, the selected observability provider must chart
`link_destination_resolution` outcomes and latency and alert on that five-in-five-minute threshold.

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
each API process maintains its own counters. Quotas and shared limiter storage must be revisited
with usage evidence before running more than one API instance.

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
