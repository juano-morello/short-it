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
RUN pnpm --filter @short-it/api prisma:generate
EXPOSE 3000
CMD ["pnpm", "--filter", "@short-it/api", "dev"]

FROM development AS build
RUN pnpm --filter @short-it/contracts build
RUN pnpm --filter @short-it/api build

FROM node:24.19.0-alpine AS production
WORKDIR /workspace
ENV NODE_ENV=production
COPY --from=build /workspace /workspace
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
