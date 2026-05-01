FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml turbo.json ./
COPY pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile=false

FROM deps AS build
COPY . .
RUN pnpm --filter @ewos/database db:generate
RUN pnpm --filter @ewos/shared build
RUN pnpm --filter @ewos/database build
RUN pnpm --filter @ewos/api build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 4000
CMD ["corepack", "pnpm", "--filter", "@ewos/api", "start:prod"]
