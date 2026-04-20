// ── Fastify instance augmentation ─────────────────────────────────────────────
// Declares custom decorators added in src/index.ts so TypeScript knows about
// them everywhere without needing to import or cast.

import type { Pool } from "pg";

declare module "fastify" {
  interface FastifyInstance {
    /** PostgreSQL connection pool — registered via app.decorate("db", pool) */
    db: Pool;
  }
}
