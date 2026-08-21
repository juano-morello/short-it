# ADR-0001: Use a pnpm and Turborepo monorepo with React, NestJS, and PostgreSQL

- Status: accepted
- Date: 2026-08-21
- Owner: Juano Morello
- Requirement links: FR-001 through FR-008
- Review conditions: Docker, CI, and package security gates must pass before initial push.

## Context

short.it needs a portfolio-quality dashboard and a full backend rather than framework-local
API handlers. It needs shared contracts, repeatable local infrastructure, and a path to
portable Docker deployment.

## Decision drivers

Clear backend ownership, an independent dashboard, explicit database migrations, coherent
testing, and deployable images.

## Considered alternatives

Next.js with route handlers, a separate multi-repository setup, and Vercel-managed services
were considered. The user preferred a NestJS backend and deferred provider coupling.

## Decision

Use pnpm workspaces and Turborepo. Put React and Vite in `apps/web`, NestJS in
`apps/api`, and PostgreSQL behind Prisma. Compose local development from Docker images,
with Caddy modeling the dashboard and workspace hostname boundary.

## Consequences and tradeoffs

The repository has more initial configuration than a single framework application, but
backend and frontend boundaries remain clear. Production image publishing and hosting are
deliberately deferred.

## Verification

Run the documented quality commands, build Docker images, validate Compose, and verify the
host routing probes locally.
