import { type FastifyInstance, type FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { Pool, type PoolConfig } from "pg";
import { env } from "../config/env.js";

// Extend FastifyInstance so all route handlers can access app.db
declare module "fastify" {
  interface FastifyInstance {
    db: Pool;
  }
}

const dbPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  const config: PoolConfig = {
    connectionString: env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    // SSL is controlled by the connection string (sslmode=no-verify for RDS,
    // nothing for local Docker). Do not force ssl here to avoid conflicts.
  };

  const pool = new Pool(config);

  // Fail fast at startup — ECS circuit breaker keeps the previous task alive
  // if the new task can't connect to the database.
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }

  app.decorate("db", pool);

  app.addHook("onClose", async () => {
    await pool.end();
    app.log.info("DB pool closed");
  });

  app.log.info("DB pool connected");
};

// fastify-plugin unwraps encapsulation so app.db is visible to all child scopes
export const db = fp(dbPlugin, {
  name: "db",
  fastify: "5.x",
});
