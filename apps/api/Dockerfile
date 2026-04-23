# syntax=docker/dockerfile:1
# ── API Dockerfile ────────────────────────────────────────────────────────────
# Stages: base → install → builder → deployer → production
#
# pnpm deploy in the deployer stage creates a symlink-free node_modules that
# is safe to COPY across Docker stages without "Cannot find package" errors.

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ── Install all workspace deps ────────────────────────────────────────────────
FROM base AS install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

# ── Development (hot-reload) ──────────────────────────────────────────────────
FROM install AS dev
COPY . .
EXPOSE 3001
CMD ["pnpm", "--filter", "api", "dev"]

# ── Build ─────────────────────────────────────────────────────────────────────
FROM install AS builder
COPY . .
RUN pnpm --filter api build

# ── Production deploy (resolves symlinks, strips devDeps) ─────────────────────
FROM builder AS deployer
RUN pnpm --filter api deploy --prod --legacy /deploy

# ── Production (immutable, minimal) ──────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 apiuser

COPY --from=deployer --chown=apiuser:nodejs /deploy/node_modules    ./node_modules
COPY --from=builder  --chown=apiuser:nodejs /app/apps/api/dist       ./dist
COPY --from=builder  --chown=apiuser:nodejs /app/apps/api/migrations ./migrations
COPY --from=builder  --chown=apiuser:nodejs /app/apps/api/package.json .

USER apiuser
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]
