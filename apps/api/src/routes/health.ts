import { type FastifyPluginAsync } from "fastify";

interface HealthResponse {
  status: "ok" | "degraded" | "down";
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  db: "ok" | "error";
}

// eslint-disable-next-line @typescript-eslint/require-await
export const healthRoutes: FastifyPluginAsync = async (app) => {
  // GET /health — liveness probe
  // Returns HTTP 200 even when degraded so the ALB keeps the target registered.
  app.get<{ Reply: HealthResponse }>(
    "/",
    {
      schema: {
        tags: ["Health"],
        summary: "Liveness probe",
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["ok", "degraded", "down"] },
              timestamp: { type: "string" },
              uptime: { type: "number" },
              version: { type: "string" },
              environment: { type: "string" },
              db: { type: "string", enum: ["ok", "error"] },
            },
          },
        },
      },
    },
    async (_req, reply) => {
      let dbStatus: "ok" | "error" = "error";
      try {
        await app.db.query("SELECT 1");
        dbStatus = "ok";
      } catch (err) {
        app.log.warn(err, "Health check DB ping failed");
      }

      return reply.status(200).send({
        status: dbStatus === "ok" ? "ok" : "degraded",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env["npm_package_version"] ?? "0.1.0",
        environment: process.env["NODE_ENV"] ?? "development",
        db: dbStatus,
      });
    }
  );

  // GET /health/ready — readiness probe (strict — fails when DB is down)
  app.get(
    "/ready",
    {
      schema: {
        tags: ["Health"],
        summary: "Readiness probe — DB connectivity required",
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              db: { type: "string" },
            },
          },
          503: {
            type: "object",
            properties: {
              status: { type: "string" },
              db: { type: "string" },
            },
          },
        },
      },
    },
    async (_req, reply) => {
      try {
        await app.db.query("SELECT 1");
        return reply.status(200).send({ status: "ok", db: "ok" });
      } catch (err) {
        app.log.error(err, "Readiness check DB ping failed");
        return reply.status(503).send({ status: "down", db: "error" });
      }
    }
  );
};
