# SPIKE-001: Can Better Auth mount cleanly inside NestJS on Express?

## Hypothesis

Better Auth can own `/api/auth/*` inside a NestJS Express application when its handler runs
before Nest JSON parsing.

## Decision supported

ADR-0001 and the authentication portion of ADR-0002.

## Options and evaluation criteria

Evaluate NestJS with Better Auth's Node handler against a direct handler mount. Criteria:
route availability, body-parser ordering, TypeScript compatibility, and audit results.

## Scope limit

This spike does not test a database-backed auth flow, workspace roles, email delivery, or
production cookies.

## Experiment setup

On 2026-08-21, a temporary Node 24.19.0 project used NestJS 11.2.1, Better Auth 1.7.1,
Express 5.2.1, TypeScript 7.0.2, and tsx 4.23.12. Nest started with `bodyParser: false`,
mounted `expressApp.all("/api/auth/*splat", toNodeHandler(auth))`, then added
`express.json()`.

## Evidence and results

`pnpm spike` passed: `GET /api/auth/ok` returned HTTP 200. Production and full
`pnpm audit` returned no known vulnerabilities. Better Auth warned that base URL and
allowed host configuration must be explicit, which this scaffold now provides.

## Limitations

The experiment used a minimal auth configuration and does not replace end-to-end auth or
organization integration tests.

## Recommendation

Use the documented handler ordering, set `BETTER_AUTH_URL` and trusted origins explicitly,
and add test coverage before user-facing auth release.

## Resulting ADRs

ADR-0001 and ADR-0002.

## Code disposition

Temporary spike code remains outside the project repository. Only the verified integration
pattern was transcribed into `apps/api/src/main.ts`.
