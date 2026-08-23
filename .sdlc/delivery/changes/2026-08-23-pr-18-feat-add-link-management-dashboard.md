# PR 18: feat: add link management dashboard

- PR: https://github.com/juano-morello/short-it/pull/18
- Merge commit: `e5a21b69dfd661fdf8d86789376260b7455b9dbd`
- Merged: 2026-08-23T00:26:44Z

## Delivered scope

- Added a membership-scoped directory of published links, paginated in newest-first pages of 50.
- Split the dashboard into native History API routes for Links, Analytics, and Settings, including browser back and forward navigation.
- Added clickable, copyable local workspace URLs that retain the active dashboard port, for example `http://workspace.localhost:8080/<cuid>`.
- Owners and editors can publish; analysts can browse immutable destinations and public URLs without publication controls.

## Decisions and safeguards

- The API derives the workspace scope from the caller's membership for every link read. Cursors are CUID-validated and resolved with the organization-and-link compound key, so a foreign link cannot influence pagination.
- Dashboard publication keeps the new link visible immediately, then refreshes the authoritative first page without allowing stale directory responses to overwrite it.
- Production SPA fallback remains deferred to WORK-009. WORK-010 covers the verified local Compose and Vite workflow only.

## Evidence

Evidence class: proven by automated verification and independent requirements, technical, test, security, operations, and engineering-excellence review.

- Default BDD: 21 scenarios and 104 steps passed; dedicated link-browsing BDD: 2 scenarios and 10 steps passed.
- API integration: 12 tests passed; serial browser suite: 7 tests passed.
- Coverage exceeded the project threshold: API branch coverage 83.33%; web branch coverage 83.74%.
- Lint, formatting, type checking, Prisma validation, Compose configuration, and production and full dependency audits passed.

## Follow-up

- Retain production image SPA route fallback as an explicit WORK-009 concern before production deployment.

Authoritative project records: `.sdlc/project/requirements.md` and `.sdlc/work/WORK-010-link-management-dashboard.md`.
