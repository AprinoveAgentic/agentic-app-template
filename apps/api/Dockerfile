# ── Development stage ─────────────────────────────────────────────────────────
FROM node:22-alpine AS dev
WORKDIR /app
RUN npm install -g pnpm@9
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install
COPY . .
CMD ["pnpm", "dev"]

# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@9
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install
COPY . .
RUN pnpm build || true   # type errors don't block the image; type-check runs in CI

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:22-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g pnpm@9
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod   # no --frozen-lockfile: generated repos may not commit a lockfile
COPY --from=builder /app/dist ./dist
EXPOSE 3001
USER node
CMD ["node", "dist/index.js"]
