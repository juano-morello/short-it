# Threat model

## Scope and assets

Assets include account credentials, sessions, workspace membership, destination URLs,
invitation IDs, link records, aggregate analytics, and service availability.

## Trust boundaries

Public visitors cross the edge proxy to redirect handling. Dashboard users cross the
same-origin app/API boundary. The API crosses to PostgreSQL. Workspace subdomains are
user-controlled names and cannot be trusted with dashboard cookies.

## Actors and abuse cases

- An unauthenticated user attempts signup abuse or credential stuffing.
- A workspace member attempts to read or mutate another workspace's data.
- An attacker submits a local, private, or non-HTTP destination to exploit redirects.
- A visitor or collaborator attempts to misuse a visible invitation ID.
- An attacker attempts to exhaust redirect or analytics capacity.

## Authentication and authorization

Better Auth email/password uses explicit trusted origins, host-only cookies, static roles,
and its built-in in-memory rate limiter for the single-instance demo. Caddy overwrites
`X-Real-IP` from the direct client connection, and Better Auth uses that value only while
calculating the rate-limit key. Session hooks clear IP and user-agent values before persistence.
Automatic sign-in after registration is disabled so duplicate registrations receive Better Auth's
generic response. The browser signs in explicitly before creating the workspace. Sign-in and
sign-up allow 20 attempts per 10 seconds in the public demo. No email verification or CAPTCHA is
planned for the demo. New workspace and invitation quotas reduce basic abuse. Authenticated API
services and Prisma scopes provide the tenant boundary. The product must never accept a browser-provided
organization ID as proof of access. Link publication permits 30 attempts per member/workspace per
ten minutes, 1,000 published links per workspace, and destination URLs of at most 2,048 characters.
The single-instance demo keeps attempt windows and quota check/write coordination in process while
the link count remains durable in PostgreSQL. A shared limiter and quota coordination are
prerequisites for multi-instance production deployment.

## Data classification and lifecycle

Credentials and session tokens are secret. Invitation IDs and destination URLs are sensitive.
Raw IPs and raw user-agent strings are forbidden from storage and logs. A keyed daily visitor
identifier has a 24-hour lifecycle. Aggregates expire after 12 months.

## Dependency and supply-chain risk

Direct packages and base images are reviewed before install. The lockfile, audit results, and
image provenance must be checked in CI and before release. GitHub Actions should move to
immutable action pins before production use.

## Network, filesystem, and infrastructure risk

The edge rejects request bodies larger than 64 KiB on `/api/*`. Tenant hosts route only `GET` and
`HEAD` CUID paths to the redirect API and return 404 for dashboard, auth, API, health, nested-path,
and unsupported-method requests. The API independently derives the workspace from the direct Host
header, rejects forwarded-host authority, and scopes the link lookup by organization ID and slug.
Only HTTP and HTTPS destinations are permitted. Redirects resolve DNS immediately before response
and reject loopback, private, link-local, carrier-grade NAT, and metadata-service addresses. A
resolver failure or resolver-capacity exhaustion returns retryable 503. This reduces, but cannot
eliminate, browser-side DNS rebinding risk. Containers run on an isolated Compose network;
production runtime must be non-root and use managed backups.

## Mitigations and verification

Destination policy, public-host policy, permission policy, publication limits, and cross-tenant
queries receive unit and integration tests. Live acceptance tests verify authentication throttling,
link-publication throttling, public redirect isolation, redirect headers, and the edge request-size
limit. Browser tests verify role-limited UI and absence of dashboard cookies on tenant-host
navigation. Redirect tests cover fresh DNS validation, resolver capacity, and generic 404 outcomes.
Security review is required before each release.

## Residual risks and owners

Distributed bot abuse, public redirect database admission, and invitation forwarding remain
accepted demo-scope risks owned by Juano. Production hardening requires CAPTCHA or equivalent
controls, provider WAF or redirect-admission limits, email delivery, backup restore evidence, image
scanning, and PostgreSQL RLS evaluation.
