# short.it

short.it is a self-service link shortener for agencies and creators. Workspaces create
immutable destination links on a workspace host and receive privacy-conscious redirect
analytics.

The v1 local demo is feature-complete against its nine functional requirements. It is not deployed
or production-ready. The repository provides portable application images, local Docker Compose
routing, executable acceptance coverage, and the engineering records needed to evaluate the product.

## Delivered v1

- Self-service account registration and workspace onboarding.
- Owner, editor, and analyst roles with owner-created copyable invitations.
- Immutable HTTP or HTTPS link publication with server-generated CUID slugs.
- A routed Links, Analytics, and Settings dashboard. Owners and editors can publish; analysts remain
  read-only.
- Redirect-only workspace hosts with destination revalidation and no dashboard-cookie exposure.
- Aggregate click, daily-visitor, time-series, referrer-host, country, and device analytics without
  persistent raw IP addresses or raw user-agent strings.
- Irreversible workspace deletion and account deletion after every owned workspace is deleted.
- Process health and PostgreSQL readiness probes.

## V1 limits

- Destinations cannot be edited after publication. Publish a new link to change a destination.
- Vanity slugs, customer domains, billing, QR codes, and a public third-party API are later product
  scope.
- Invitations use copyable links. Email delivery, email verification, and password-recovery delivery
  are not configured.
- Ownership transfer, leaving, member removal, and role mutation are unavailable.
- Country enrichment is not configured, so the launch country value remains `Unknown`.
- Local rate limits and several capacity gates coordinate within one API process.

## Stack

- React and Vite dashboard in `apps/web`
- NestJS and Better Auth API in `apps/api`
- PostgreSQL and Prisma
- pnpm workspaces and Turborepo
- Docker Compose with Caddy host routing for local development

## Local start

1. Copy `.env.example` to `.env` and replace the development secret.
2. Run `pnpm install --frozen-lockfile`.
3. Run `pnpm db:generate`.
4. Run `docker compose up --build`.
5. Open `http://app.localhost:8080`.

The included Compose database is disposable development state. Production hosting,
PostgreSQL provider selection, DNS, and image publishing remain intentionally deferred.

## Quality

The GitHub Quality workflow runs formatting, lint, type checks, unit and PostgreSQL integration tests,
coverage, Prisma validation, Storybook, Docker and Compose builds, dependency audits, executable
Gherkin profiles, and Playwright browser tests. Product-code coverage must remain at least 80 percent.

Common local commands:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm bdd
pnpm e2e
pnpm coverage
pnpm build
pnpm storybook:build
pnpm db:validate
pnpm compose:config
pnpm docker:build
pnpm security
```

## Project records

- [Current status](.sdlc/project/status.md)
- [Product brief](.sdlc/project/product-brief.md)
- [Requirements](.sdlc/project/requirements.md)
- [Roadmap](.sdlc/project/roadmap.md)
- [Architecture](.sdlc/architecture/overview.md)
- [Operations](.sdlc/architecture/operations.md)
- [Test strategy](.sdlc/quality/test-strategy.md)
- [Threat model](.sdlc/quality/threat-model.md)
- [Technical-debt backlog](.sdlc/quality/technical-debt.md)
