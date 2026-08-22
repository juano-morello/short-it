# Test strategy

## Behavior and BDD

Core product slices use executable Gherkin. The scaffold begins with the health-probe feature.
WORK-002 covers registration, workspace ownership, safe handle creation, and isolated rate-limit
behavior. WORK-003 covers server-generated CUID link publication, destination safety, and
tenant-scoped authorization. WORK-004 covers public-host redirects, redirect-time destination
validation, and tenant-route isolation. WORK-005 covers privacy-preserving redirect analytics,
authenticated workspace reporting, and aggregate retention. A future slice covers deletion lifecycle.

## Outside-in TDD workflow

Write an acceptance scenario, create the smallest failing boundary test, implement the
minimum behavior, then add focused unit tests for policy and transformation edges.

## Unit tests

Vitest covers controllers, destination policy, public-host parsing, aggregation, role policy, and UI
components.
The scaffold includes a health controller and dashboard metric-card test. WORK-002 adds
session-aware onboarding, sign-in, account-error, and workspace-retry UI coverage. Its rate-limit
scenario runs alone against a fresh Compose stack because its counter is intentionally process-local.

## Integration and contract tests

Use Testcontainers PostgreSQL for Prisma migrations, Better Auth organization behavior,
database scoping, and redirect persistence. The current internal link API owns its request and
response representation in its server and browser gateways; a package-level shared contract is
reserved for a future public or cross-client API.

## E2E and visual regression

Playwright owns browser flows. WORK-002 adds a real browser scenario that registers an account,
signs in, creates a workspace, and verifies the owner dashboard. WORK-004 creates a published link,
checks its public redirect response, and proves a dashboard cookie is not sent to the tenant host.
WORK-005 follows a public redirect through to the dashboard's aggregate analytics view and waits for
best-effort persistence before asserting presentation. Storybook documents dashboard components and
supports future visual checks.

## Test data and isolation

Each integration test receives an isolated database lifecycle. The BDD suite executes inside the
local API container so its role fixtures can use the private Compose database without publishing
PostgreSQL to the host. Fixtures use synthetic URLs, emails, countries, and referrer hosts only.

## Coverage policy

The target is at least 80 percent line coverage for product code. Coverage exclusions require
a recorded review. Generated Prisma artifacts are excluded. The initial coverage gate excludes
composition-root, environment, database-client, and auth-provider composition root; those boundaries are
instead verified through the live Compose migration, probe, signup, and browser smoke checks.

## Performance and resilience

WORK-004 tests redirect-time DNS revalidation, family-resolution failures, timeout, capacity
exhaustion, and concurrent same-host coalescing. WORK-005 tests valid redirects when analytics
persistence is blocked, bounded capture admission, same-day digest deduplication, referrer capping
under concurrency, aggregate retention, and dashboard reporting. Load and latency targets are
deferred until hosting is selected.

## CI gates and exact commands

Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm test:integration`, `pnpm bdd`, `pnpm bdd:analytics`,
`pnpm bdd:publication-guardrails`, `pnpm bdd:rate-limit`, `pnpm e2e`, `pnpm coverage`,
`pnpm db:validate`, `pnpm storybook:build`, `pnpm compose:config`,
`pnpm docker:build`, and `pnpm security`.

## Flake handling

Do not retry an unexplained failing test. Capture deterministic inputs and isolate external
network access. Quarantine only after a documented review with an owner and removal date.
