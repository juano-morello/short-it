# PR 2: feat: publish workspace links

- PR: https://github.com/juano-morello/short-it/pull/2
- Merge commit: `29a33d455d09bab9e11bb4b182affce82df77475`
- Merged: 2026-08-21T22:23:34Z

## Delivered scope

Owners and editors can publish immutable HTTP(S) destinations for their workspace. The API
generates CUID slugs, sets `publishedAt` at creation, and derives the persisted organization from
the authenticated membership record rather than a browser claim.

## Decisions and safeguards

Immediate publication and server-generated CUID slugs were approved for launch. Vanity slugs are
deferred to v1.1. Destination validation rejects non-web schemes, credentials, and unsafe DNS or
literal-address ranges. Publication is limited to 30 authorized attempts per member/workspace in
ten minutes, 1,000 published links per workspace, and normalized destination URLs of at most 2,048
characters.

## Verification

The Quality workflow passed. Repository evidence includes unit, PostgreSQL integration, core BDD,
publication-guardrail BDD, authentication-throttle BDD, and browser E2E coverage. Format, lint,
typecheck, Prisma validation, application and Storybook builds, Compose configuration, Docker
build, and dependency audit passed. Product, technical, test, security, operations, and
engineering-excellence reviews found no remaining blocker.

## Operations and follow-up

The demo keeps publication attempt windows and quota check/write coordination in one API process;
the published-link count is durable PostgreSQL state. Multi-instance production needs equivalent
shared limiter and quota coordination. WORK-004 must re-resolve and revalidate destinations on the
redirect path to limit DNS rebinding exposure.
