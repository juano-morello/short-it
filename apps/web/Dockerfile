FROM node:24.19.0-alpine AS base
RUN corepack enable
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/e2e/package.json apps/e2e/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/design-system/package.json packages/design-system/package.json
RUN pnpm install --frozen-lockfile

FROM base AS development
COPY . .
EXPOSE 5173
CMD ["pnpm", "--filter", "@short-it/web", "dev"]

FROM development AS build
RUN pnpm --filter @short-it/web build

FROM caddy:2.10.2-alpine AS production
COPY --from=build /workspace/apps/web/dist /usr/share/caddy
