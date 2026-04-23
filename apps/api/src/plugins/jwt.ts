import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { env } from "../config/env.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; email: string };
    user: { sub: string; email: string };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    refreshJwtSign: (payload: { sub: string; email: string }) => string;
  }
}

const jwtPluginImpl: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Access token — short-lived (15 min)
  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: "15m" },
  });

  // Refresh token — long-lived (7 days), separate secret
  await app.register(fastifyJwt, {
    secret: env.JWT_REFRESH_SECRET,
    sign: { expiresIn: "7d" },
    namespace: "refreshJwt",
    jwtVerify: "refreshJwtVerify",
    jwtSign: "refreshJwtSign",
  });

  app.decorate(
    "refreshJwtSign",
    function refreshJwtSign(payload: { sub: string; email: string }): string {
      const jwtWithNamespace = app.jwt as unknown as {
        refreshJwt: { sign: (p: { sub: string; email: string }) => string };
      };
      return jwtWithNamespace.refreshJwt.sign(payload);
    }
  );
};

export const jwtPlugin = fp(jwtPluginImpl, { name: "jwt", fastify: "5.x" });
