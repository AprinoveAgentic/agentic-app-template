import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { db } from "./plugins/db.js";
import { jwtPlugin } from "./plugins/jwt.js";
import { authenticatePlugin } from "./plugins/authenticate.js";
import { env } from "./config/env.js";

const app = Fastify({
  logger: {
    level: env.LOG_LEVEL,
    ...(env.NODE_ENV === "development" && {
      transport: {
        target: "pino-pretty",
        options: { colorize: true },
      },
    }),
  },
});

// ── Security ──────────────────────────────────────────────────────────────────
await app.register(helmet, { contentSecurityPolicy: false });
await app.register(cors, {
  origin: env.CORS_ORIGIN,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
});
await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
});

// ── OpenAPI docs (development only) ──────────────────────────────────────────
if (env.NODE_ENV !== "production") {
  await app.register(swagger, {
    openapi: {
      info: { title: "App API", description: "API documentation", version: "0.1.0" },
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });
}

// ── Database ──────────────────────────────────────────────────────────────────
await app.register(db);

// ── Auth ──────────────────────────────────────────────────────────────────────
await app.register(jwtPlugin);
await app.register(authenticatePlugin);

// ── Routes ────────────────────────────────────────────────────────────────────
await app.register(healthRoutes, { prefix: "/health" });
await app.register(authRoutes, { prefix: "/auth" });
// [Build Agent: import and register new route modules below this line]

// ── Start ─────────────────────────────────────────────────────────────────────
try {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  app.log.info(`API running on port ${env.PORT} [${env.NODE_ENV}]`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
