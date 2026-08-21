# PR 1: feat: add workspace onboarding

- PR: https://github.com/juano-morello/short-it/pull/1
- Merge commit: `a4133d9e1ff664cae61332f6e8c0462de86f0c65`
- Merged: 2026-08-21T20:03:16Z

## Delivered scope

WORK-002 adds self-service workspace onboarding. A visitor creates an account, explicitly signs
in, chooses a workspace name and public handle, and reaches the owner dashboard. Signed-in users
without a workspace remain in an authenticated onboarding state and can retry a failed workspace
creation without creating another account.

The work delivers FR-001 and preserves the organization-scoped authorization boundary. Workspace
handles are enforced on create and update: 3 to 30 lowercase letters or digits with internal
hyphens only. `app`, `api`, and `www` remain reserved.

## Decisions and safeguards

Better Auth 1.7.1 is a direct web dependency. Registration does not create a session. It always
returns the visitor to an explicit sign-in step, including Better Auth's generic duplicate-account
response. Account-name validation runs before Better Auth's duplicate-email lookup.

Caddy accepts API request bodies up to 64 KiB and overwrites `X-Real-IP` from the direct client
connection. Better Auth uses the header only for the in-memory sign-in and sign-up limiter, set to
20 attempts per 10 seconds. Session hooks clear IP and user-agent values before persistence.

## Verification and disposition

GitHub Actions passed the complete quality workflow on the merge commit. It ran formatting, lint,
type checks, unit and integration tests, coverage, Prisma validation, Storybook and Docker builds,
dependency audits, non-throttle BDD, an isolated fresh-stack throttle BDD scenario, and Playwright
browser tests. Independent product, technical, test, security, operations, and engineering-quality
reviews completed without remaining actionable findings.

No schema migration, production deployment, email verification, or customer-domain work was
introduced. The in-memory rate limiter is appropriate only for the single-instance demo. Before
WORK-003, extract an app-owned authentication and workspace gateway so Better Auth client calls do
not remain in the presentation component.

Authoritative project records: `.sdlc/work/WORK-002-self-service-workspace-onboarding.md`,
`.sdlc/quality/threat-model.md`, `.sdlc/architecture/operations.md`, and
`.sdlc/quality/test-strategy.md`.
