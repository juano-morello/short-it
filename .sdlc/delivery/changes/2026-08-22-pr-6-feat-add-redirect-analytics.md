# PR 6: feat: add redirect analytics

- PR: https://github.com/juano-morello/short-it/pull/6
- Merge commit: `63f8ae377c2b14e7c17517ce058c767d96260acb`
- Merged: 2026-08-22T14:23:21Z

## Delivered scope

FR-005 is delivered. Successful public `GET` redirects record per-link daily clicks, daily unique
link visitors, and country, device, and referrer-host breakdowns. Owner, editor, and analyst
members can read their workspace aggregate overview. Launch records `Unknown` country.

## Decisions and safeguards

Capture runs after the `302` response is committed and cannot delay or change a redirect. Caddy
overwrites the dedicated client-IP header used only to derive a keyed daily digest. Raw IP addresses
and raw user-agent strings are neither persisted nor logged. Analytics uses a distinct two-connection
PostgreSQL pool and a 20-capture in-process gate; excess or failed capture is dropped safely.

The aggregate schema is an additive Prisma migration. Referrer storage is capped at 100 hosts per
link and UTC day, with later hosts grouped as `other`. Visitor digests remain through UTC midnight
to preserve exact daily deduplication, then have an explicitly approved maximum five-minute physical
cleanup grace. Aggregates are retained for 12 months.

## Verification

Evidence class: proven by the merged implementation and CI. The Quality workflow passed formatting,
lint, type checks, unit and PostgreSQL integration tests, coverage, Prisma validation, Storybook,
Compose, Docker, and dependency security checks. It also passed default, analytics, publication, and
rate-limit BDD profiles plus browser E2E tests. Product, technical, test, security, operations, and
engineering-excellence reviews approved the change.

## Operations and follow-up

Before production, run the prune command at least every five minutes. Treat any prune failure as an
immediate retention breach and alert again if no successful prune event arrives for ten minutes. The
capture gate and database pool are process-local; multi-instance production needs shared admission
control. A future production country source must be authenticated by the edge. Vanity slugs remain
planned for v1.1.

Authoritative project records: `.sdlc/work/WORK-005-redirect-analytics.md`,
`.sdlc/decisions/ADR-0003-privacy-and-redirects.md`, `.sdlc/architecture/operations.md`, and
`.sdlc/quality/threat-model.md`.
