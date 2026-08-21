# Operations

## Environments and ownership

Local Compose is the only runnable environment in this scaffold. Juano owns production
deployment and provider selection decisions. A future deployment should use US East and a
managed PostgreSQL service.

Docker build contexts exclude local dependency trees, generated output, test artifacts, Git
metadata, and environment files through `.dockerignore`. This preserves reproducible image
dependency installation and keeps developer secrets out of image contexts.

## Logs, metrics, and traces

The API must emit structured, privacy-safe logs with request IDs. It must not log raw IPs,
raw user agents, session tokens, invitation URLs, or destination query strings. Product
metrics include redirect success and failure and analytics-write failures.

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

No provider or paid resource is provisioned. Quotas for new workspaces are intentionally
conservative in the auth configuration and must be revisited with usage evidence.

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
