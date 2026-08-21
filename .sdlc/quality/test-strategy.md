# Test strategy

## Behavior and BDD

Core product slices use executable Gherkin. The scaffold begins with the health-probe feature.
Upcoming features cover registration, workspace roles, safe link creation, redirect-first
behavior, analytics, and deletion lifecycle.

## Outside-in TDD workflow

Write an acceptance scenario, create the smallest failing boundary test, implement the
minimum behavior, then add focused unit tests for policy and transformation edges.

## Unit tests

Vitest covers controllers, destination policy, aggregation, role policy, and UI components.
The scaffold includes a health controller and dashboard metric-card test.

## Integration and contract tests

Use Testcontainers PostgreSQL for Prisma migrations, Better Auth organization behavior,
database scoping, and redirect persistence. Shared contracts prevent dashboard/API shape
drift.

## E2E and visual regression

Playwright owns browser flows. The current scaffold validates the Playwright discovery
contract; the first self-service slice must replace the skipped placeholder with a real
browser scenario. Storybook documents dashboard components and supports future visual checks.

## Test data and isolation

Each integration test receives an isolated database lifecycle. Fixtures use synthetic URLs,
emails, countries, and referrer hosts only.

## Coverage policy

The target is at least 80 percent line coverage for product code. Coverage exclusions require
a recorded review. Generated Prisma artifacts are excluded. The initial coverage gate excludes
composition-root, environment, database-client, and auth-provider wiring; those boundaries are
instead verified through the live Compose migration, probe, signup, and browser smoke checks.

## Performance and resilience

Before public release, test redirect behavior when telemetry, aggregation, and optional
enrichment fail. Load and latency targets are deferred until hosting is selected.

## CI gates and exact commands

Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm test:integration`, `pnpm bdd`, `pnpm e2e`, `pnpm coverage`,
`pnpm db:validate`, `pnpm storybook:build`, `pnpm compose:config`,
`pnpm docker:build`, and `pnpm security`.

## Flake handling

Do not retry an unexplained failing test. Capture deterministic inputs and isolate external
network access. Quarantine only after a documented review with an owner and removal date.
