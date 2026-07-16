# agentic-app-template

Golden-path application template for the [Agentic Delivery Platform](https://github.com/AprinoveAgentic/agentic-delivery-platform).
Fastify 5 API + Next.js 14 web + shared Zod schemas, wired to PostgreSQL, ECS Fargate and GitHub Actions OIDC.

New client apps are generated from this repo, so changes here land in every future app.

## Quick start

```bash
cp .env.example .env
pnpm install
pnpm dev          # DB + API + Web via Docker Compose
```

| Service    | URL                          |
| ---------- | ---------------------------- |
| Web        | http://localhost:3000        |
| API        | http://localhost:3001        |
| API docs   | http://localhost:3001/docs   |
| PostgreSQL | localhost:5432               |

## Layout

```
apps/
  api/              Fastify 5 backend (TypeScript, Zod, node-pg-migrate)
  web/              Next.js 14 frontend (App Router, Tailwind)
packages/
  shared/           Zod schemas + API types imported by both apps (@app/shared)
infra/              (per-app) Terraform, added at generation time
```

## Commands

Run from the repo root; each maps to a workspace-recursive pnpm script.

```bash
pnpm dev            # start full local stack
pnpm stop           # stop containers
pnpm logs           # tail all containers (logs:api / logs:web to narrow)
pnpm build          # build packages, then apps
pnpm test           # Vitest, all workspaces
pnpm lint           # ESLint, all workspaces
pnpm type-check     # tsc --noEmit, all workspaces
pnpm check          # lint + format:check + type-check
pnpm migrate        # apply pending migrations
pnpm migrate:create # scaffold a new migration
```

## Architecture rules

- TypeScript strict everywhere — no `any`, no suppression comments.
- Zod validation at every boundary: request body, response, and env vars.
- Database access only through `app.db` (a `pg` Pool) — no ORM. The decorator and
  its `FastifyInstance` type augmentation both live in `apps/api/src/plugins/db.ts`.
- Auth is JWT: 15m access + 7d refresh with rotation.
- Logging via `fastify.log` — no `console.log` in production code.
- Shared types belong in `packages/shared/src/types/api.ts`, never duplicated per app.

## Adding a feature

**API route** — add `apps/api/src/routes/<feature>.ts` (Zod schemas + handlers) and
`apps/api/src/services/<feature>.service.ts` (queries), then register the route in
`apps/api/src/index.ts`. Schema changes go in `apps/api/migrations/00N_<description>.sql`.

**Web page** — add `apps/web/src/app/<feature>/page.tsx`, use the `useAuth()` hook for
auth state and the helpers in `apps/web/src/lib/api.ts` for API calls.

## Migrations

`node-pg-migrate`, files in `apps/api/migrations/`, named sequentially
(`001_description.sql`). Every migration must be backward-compatible with the
previously deployed app version, because ECS rolls out gradually and both versions
run against the same database during a deploy.

## Environment

Copy `.env.example` to `.env` for local dev. In AWS, every value comes from Secrets
Manager under `/<app>/<env>/<key>`. `.env` is gitignored and must stay that way.

`JWT_SECRET` and `JWT_REFRESH_SECRET` must be at least 32 chars — generate with
`openssl rand -base64 48`. `ALLOWED_EMAIL_DOMAINS` gates registration; empty means
open registration, so set it before exposing an app publicly.

## CI/CD

- `pr-checks.yml` — lint, type-check and tests on every PR.
- `deploy.yml` — on merge to `main`: build images → push to ECR → `ecs update-service`.

AWS auth is OIDC only; there are no stored access keys. Configure before first deploy:

| Repository variable | Example              |
| ------------------- | -------------------- |
| `ECR_REPO_API`      | `my-app-api`         |
| `ECR_REPO_WEB`      | `my-app-web`         |
| `ECS_CLUSTER`       | `my-app-prod-cluster`|
| `ECS_SERVICE_API`   | `my-app-prod-api`    |
| `ECS_SERVICE_WEB`   | `my-app-prod-web`    |

| Repository secret     | Value                             |
| --------------------- | --------------------------------- |
| `AWS_DEPLOY_ROLE_ARN` | IAM role ARN for OIDC deployment  |

## Notes for generated apps

- Replace this README's title and description with the app's own.
- `app_slug` drives AWS resource naming (`<app_slug>-prod-<resource>`); it must be
  lowercase alphanumeric plus hyphens, and 28 characters or fewer — ALB names cap at
  32 and the module appends `-alb`.
