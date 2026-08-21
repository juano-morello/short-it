# short.it

short.it is a self-service link shortener for agencies and creators. Workspaces create
immutable destination links on a workspace host and receive privacy-conscious redirect
analytics.

This repository is the approved foundation, not a production deployment. It provides the
monorepo, authentication seam, Prisma schema, Docker topology, CI gates, and product
records for the first vertical slices.

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

## Quality commands

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm bdd
pnpm e2e
pnpm coverage
pnpm storybook:build
pnpm db:validate
pnpm compose:config
pnpm security
```

Read the living project records in [`.sdlc`](.sdlc).
