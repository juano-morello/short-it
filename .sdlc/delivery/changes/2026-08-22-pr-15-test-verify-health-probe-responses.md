# PR 15: test: verify health probe responses

- PR: https://github.com/juano-morello/short-it/pull/15
- Merge commit: `aadd4f9f53433c632465104145c6bcd563287c95`
- Merged: 2026-08-22T23:00:07Z

## Delivered scope

FR-008 is delivered for the portable V1 demo. Unauthenticated dashboard-host requests to
`/api/health` and `/api/ready` are proven to return HTTP 200 with the documented process and
PostgreSQL-ready projections.

PR 16 adds the associated failure-path evidence: a rejected PostgreSQL query cannot report the
ready projection. The existing framework failure response is intentionally retained; no new public
failure contract or Compose topology was added.

## Verification

Evidence class: proven by merged implementation and successful GitHub Quality workflows for PRs 15
and 16. The workflows passed the full repository quality matrix. Independent requirements,
technical, test, security, operations, and engineering-excellence reviews found no remaining
in-scope finding after the failure-path test.

## Scope and follow-up

No provider, deployment, infrastructure provisioning, dependency, schema, or public-contract
expansion was introduced. A stable readiness failure response and Compose health gate remain
future production-readiness decisions.

Authoritative project records: `.sdlc/work/WORK-008-health-readiness-closeout.md` and
`.sdlc/architecture/operations.md`.
