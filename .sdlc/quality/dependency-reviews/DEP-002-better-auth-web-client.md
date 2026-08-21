# DEP-002: Better Auth browser client scope change

- Reviewer: Juano-approved WORK-002 execution
- Date: 2026-08-21
- Package: `better-auth@1.7.1`
- Change: add the already pinned package as a direct production dependency of `apps/web`
- Approval: approved by Juano before manifest modification

## Purpose and alternatives

The React dashboard needs the supported typed client for email/password sessions and the
organization plugin endpoints. A manual `fetch` wrapper would duplicate request shapes, cookie
handling, plugin contracts, and error normalization. A custom Nest onboarding API would duplicate
Better Auth's authorization boundary.

## Provenance, maintenance, and license

`better-auth` is the official package already used by `apps/api` at version 1.7.1. DEP-001
recorded the initial review: official provenance, MIT license, auth-sensitive risk, and audited
installation. Better Auth's official React and organization documentation specifies
`createAuthClient` and `organizationClient` for this use.

## Risk and disposition

Adding the direct declaration changes frontend supply-chain ownership but does not introduce a
new resolved package version. The existing lockfile version, lifecycle policy, and production and
full dependency audits remain required. The client is restricted to same-origin requests and
cannot grant roles or select a user ID. Approved for WORK-002.
