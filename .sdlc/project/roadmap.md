# Roadmap

## Ownership and commitment

Juano owns product priority, production scope, and accepted tradeoffs. This record classifies future
work; it does not approve implementation, spending, infrastructure, deployment, or a release date.

## Classification

- **Product roadmap** adds or changes user-facing capability.
- **Production readiness** makes approved behavior safe and operable in a hosted environment.
- **Technical debt** records an engineering liability in the current implementation.
- **Accepted risk** records exposure that Juano has explicitly accepted for a stated scope.

One item can have related work in more than one category, but its records must name the different
outcomes. For example, verified-email invitations add product behavior, while production invitation
abuse controls mitigate an operational and security risk.

## Completed milestone: v1 local demo

FR-001 through FR-009 are delivered. The v1 demo supports onboarding, static workspace roles,
copyable invitations, immutable link publication, public redirects, privacy-conscious aggregate
analytics, a routed link dashboard, workspace deletion, account deletion, health, and readiness.

The authoritative milestone disposition is in the [current status](status.md).

## Production-readiness candidates

These candidates require separate refinement and approval before implementation:

1. **WORK-009: production web-image routing.** Serve the dashboard entry point and its native
   `/links`, `/analytics`, and `/settings` routes from the production web image while preserving
   static-asset failures and tenant-host isolation.
2. **Hosting topology.** Select the provider, region, managed PostgreSQL service, image registry,
   TLS and DNS ownership, secret management, and migration execution model.
3. **Retention operation.** Schedule analytics and invitation pruning at least every five minutes
   and alert on failures or missing success events.
4. **Recovery.** Select a backup owner and prove restore behavior against the intended RPO and RTO.
5. **Observability and capacity.** Provide the required dashboards, alerts, load evidence, lock-wait
   telemetry, connection-saturation telemetry, and rollout thresholds.
6. **Public admission and scaling.** Add shared limits and quota coordination where more than one API
   process or public production traffic requires them.
7. **Release hardening.** Complete the pre-production supply-chain and runtime controls in the threat
   model and technical-debt backlog.

The operations record owns detailed hosted-rollout conditions. The technical-debt backlog owns the
current implementation liabilities behind these candidates.

## Candidate v1.1 product scope

- User-selected vanity slugs, including collision rules, reserved values, and public contract.

No other feature is assigned to v1.1.

## Later product candidates

- Customer-owned custom domains.
- Workspace ownership transfer, leaving, member removal, and role management.
- Verified-email invitations and outbound email delivery.
- Password-recovery delivery.
- Billing, QR codes, and a public third-party API.
- Automated abuse moderation.

These remain non-goals until Juano approves a work item. Their presence here is not a commitment to
scope or sequence.

## Open product and operations decisions

- Whether the next milestone is production readiness or later product scope.
- Which provider and region own the hosted application and PostgreSQL service.
- Which operator owns backups, restore evidence, retention schedules, alerts, and incident response.
- Which production quota and admission values replace the single-process demo controls.
