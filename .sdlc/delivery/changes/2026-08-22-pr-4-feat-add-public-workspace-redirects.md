# PR 4: feat: add public workspace redirects

- PR: https://github.com/juano-morello/short-it/pull/4
- Merge commit: `abffcc4b4247a6d1df7617037491754234c316bc`
- Merged: 2026-08-22T00:12:33Z

## Delivered scope

- FR-004 is delivered: a valid `<workspace>.<base-domain>/<cuid>` host resolves a published link
  within that workspace and returns the immutable destination in an uncached `302` response.
- Tenant hosts expose only `GET` and `HEAD` redirect requests. Dashboard, authentication, API,
  health, nested paths, unsupported methods, and malformed hosts remain unavailable.
- The API derives the organization from the validated host and scopes link lookup by
  `organizationId` and CUID. The browser does not supply tenant authority.

## Decisions and safeguards

- Redirects send `Cache-Control: no-store` and `Referrer-Policy: no-referrer`; incoming query
  parameters are ignored.
- Unknown, unpublished, malformed, cross-workspace, and permanently unsafe destinations return a
  generic `404` without `Location`. Transient DNS errors and redirect DNS capacity exhaustion
  return `503` with `Retry-After` and no `Location`.
- Destination DNS resolves again for every redirect. Redirect validation has a separate two-second,
  ten-request capacity gate and only coalesces simultaneous checks for the same hostname.
- No dependency or Prisma migration was added. Public redirect logs contain only a request ID,
  coarse outcome, status, and latency.

## Verification

Evidence class: proven by the merged implementation and CI. The public quality workflow passed
formatting, lint, types, unit and PostgreSQL integration tests, coverage, Prisma validation,
Storybook, Compose, Docker, dependency security checks, BDD, and browser tests. API coverage was
93.51% statements and 87.43% branches. Product, technical, test, security, operations, and
engineering-excellence reviews approved the change.

## Limitations and follow-up

Juano accepted the residual browser-side DNS-rebinding risk. Before public production traffic or
multiple API instances, add edge or WAF admission control, or a shared redirect limiter, because
the local DNS gate does not limit database lookups. Redirect analytics remain deferred to WORK-005;
vanity slugs remain planned for v1.1.
