import fp from "fastify-plugin";
import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const authenticatePluginImpl: FastifyPluginAsync = (
  app: FastifyInstance
): Promise<void> => {
  app.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
      } catch {
        await reply.status(401).send({
          error: { code: "UNAUTHORIZED", message: "Invalid or expired access token" },
        });
      }
    }
  );
  return Promise.resolve();
};

export const authenticatePlugin = fp(authenticatePluginImpl, {
  name: "authenticate",
  fastify: "5.x",
  dependencies: ["jwt"],
});
