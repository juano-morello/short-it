# DEP-001: Initial direct dependencies

- Reviewer: Juano-approved scaffold execution, evidence recorded 2026-08-21
- Registry: npm and Docker Hub official images
- Lockfile impact: initial `pnpm-lock.yaml` only
- approval: approved

Each entry below is a direct dependency change. Production entries were approved in the
engineering gate. Development entries are within the approved scaffold plan.

| Package or image | Version | Scope | Purpose | Alternative considered | Provenance and maintenance signal | License and install risk | disposition |
|---|---:|---|---|---|---|---|---|
| @nestjs/common, core, platform-express | 11.2.1 | production | Dedicated HTTP API | Framework-local handlers | Official NestJS packages, compatibility spike | MIT; normal npm lifecycle review required | approved |
| better-auth | 1.7.1 | production | Email/password and organizations | Build auth in-house | Official Better Auth package, compatibility spike | MIT; auth-sensitive, audited after install | approved |
| @prisma/client | 7.9.1 | production | Typed PostgreSQL access | Raw SQL or Drizzle | Official Prisma client | Apache-2.0; generated client reviewed | approved |
| @prisma/adapter-pg, pg | 7.9.1, 8.23.0 | production | Prisma 7 PostgreSQL driver adapter | Prisma 6 without an adapter | Official Prisma adapter and node-postgres | Apache-2.0/MIT; driver connection path is covered by integration tests | approved |
| express | 5.2.1 | production | Nest platform and auth handler mount | Fastify adapter | Official Express package, spike validated | MIT; request parsing surface | approved |
| reflect-metadata, rxjs | 0.2.2, 7.8.2 | production | Nest runtime requirements | None | Nest ecosystem standards | Apache-2.0; transitives audited | approved |
| react, react-dom | 19.2.8 | production | Dashboard runtime | Server-rendered UI | Official React packages | MIT; transitives audited | approved |
| postgres | 16-alpine | production image | Local disposable database | Hosted-only development | Docker Official Image | PostgreSQL license; pin to digest before production | approved |
| caddy | 2.10.2-alpine | production image | Portable host routing | Nginx or provider proxy | Official Caddy image | Apache-2.0; pin to digest before production | approved |
| node | 24.19.0-alpine | production image | Application runtime | Node 22 | Official Node image, local runtime matches | MIT; pin to digest before production | approved |
| @biomejs/biome | 2.5.10 | development | Format and lint gate | ESLint plus Prettier | Official Biome package | MIT; executable package, audited | approved |
| turbo | 2.10.11 | development | Workspace task graph | Raw pnpm scripts | Vercel-maintained package | MIT; executable package, audited | approved |
| typescript, tsx | 5.9.3, 4.23.12 | development | Typechecking and TS runner | Babel | Microsoft and Privatenumber packages | Apache-2.0/MIT; audited | approved |
| prisma | 7.9.1 | development | Schema validation and client generation | SQL-only migrations | Official Prisma CLI | Apache-2.0; generator executable, audited | approved |
| vitest, @vitest/coverage-v8 | 4.1.11 | development | Unit and coverage testing | Jest | Vitest project | MIT; audited | approved |
| testcontainers, @testcontainers/postgresql | 12.1.0 | development | Disposable PostgreSQL integration database | Shared local test database | Testcontainers project | MIT; Docker daemon and official PostgreSQL image required | approved |
| @cucumber/cucumber | 13.2.1 | development | Executable Gherkin | Non-executable feature files | Cucumber project | MIT; audited | approved |
| @playwright/test | 1.62.1 | development | Browser acceptance harness | Cypress | Microsoft package | Apache-2.0; browser download is explicit | approved |
| Storybook, @storybook/react-vite | 10.5.10 | development | Component documentation | No component catalog | Storybook project | MIT; audited | approved |
| vite, @vitejs/plugin-react | 8.2.2, 6.1.0 | development | Dashboard build and dev server | Webpack | Vite project | MIT; audited | approved |
| @types packages | listed lockfile | development | Type declarations | Inline declarations | DefinitelyTyped ecosystem | MIT; audited | approved |

## Evidence and follow-up

Registry versions were checked before installation. The Better Auth and NestJS combination was
proven in SPIKE-001. After installation, record `pnpm audit --prod`, full `pnpm audit`,
and lockfile verification in the delivery record. Before a production release, pin Docker
images and GitHub Actions by immutable digest or commit and run an image scanner.

pnpm initially blocked lifecycle scripts. The reviewed scripts are now explicitly allowed:
`@prisma/engines` runs `node scripts/postinstall.js` to prepare engine binaries,
`prisma` runs a preinstall compatibility check, and `esbuild` runs `node install.js`
to select its platform binary. They are needed for Prisma generation and the Vite toolchain;
no other dependency lifecycle script is allowed by this repository configuration.

Testcontainers introduced transitive optional native packages. Their lifecycle scripts are
explicitly blocked: `cpu-features` would compile native code, `ssh2` would select an
optional native feature, and `protobufjs` only runs a package postinstall. The PostgreSQL
container test does not require those scripts, so `pnpm-workspace.yaml` records them as
`false` rather than implicitly trusting them.

On 2026-08-21, the production audit reported GHSA-ggr8-5vv4-36mx against transitive
`deepmerge-ts@7.1.5` from `@prisma/config@7.9.1`. Prisma 7.9.1 was the current selected
release, while the advisory is patched in `deepmerge-ts@8.0.0` and later. The workspace
therefore pins the smallest current patched release, `8.0.2`, using a pnpm override. The
complete verification suite must pass against that override before it can be accepted.
