import { type FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  createUser,
  findUserByEmail,
  dummyVerify,
  verifyPassword,
  storeRefreshToken,
  findAndConsumeRefreshToken,
  findUserById,
  revokeUserRefreshTokens,
} from "../services/auth.service.js";
import { env } from "../config/env.js";

// ── Schemas ────────────────────────────────────────────────────────────────────

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string(),
});

const RefreshBody = z.object({
  refreshToken: z.string(),
});

// ── Routes ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/require-await
export const authRoutes: FastifyPluginAsync = async (app) => {
  // POST /auth/register
  app.post("/register", async (req, reply) => {
    const body = RegisterBody.parse(req.body);

    // Domain allowlist check
    if (env.ALLOWED_EMAIL_DOMAINS.length > 0) {
      const domain = body.email.split("@")[1]?.toLowerCase() ?? "";
      if (!env.ALLOWED_EMAIL_DOMAINS.includes(domain)) {
        return reply
          .status(403)
          .send({ error: { code: "DOMAIN_NOT_ALLOWED", message: "Email domain not permitted" } });
      }
    }

    const existing = await findUserByEmail(app.db, body.email);
    if (existing) {
      return reply
        .status(409)
        .send({ error: { code: "EMAIL_TAKEN", message: "Email already registered" } });
    }

    const user = await createUser(app.db, body);

    const accessToken = app.jwt.sign({ sub: user.id, email: user.email });
    const rawRefresh = app.refreshJwtSign({ sub: user.id, email: user.email });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000);
    await storeRefreshToken(app.db, {
      userId: user.id,
      rawToken: rawRefresh,
      expiresAt,
    });

    return reply.status(201).send({
      user: { id: user.id, email: user.email, name: user.name },
      accessToken,
      refreshToken: rawRefresh,
    });
  });

  // POST /auth/login
  app.post("/login", async (req, reply) => {
    const body = LoginBody.parse(req.body);

    const user = await findUserByEmail(app.db, body.email);
    if (!user) {
      await dummyVerify();
      return reply
        .status(401)
        .send({ error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } });
    }

    const valid = await verifyPassword(user.password_hash, body.password);
    if (!valid) {
      return reply
        .status(401)
        .send({ error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } });
    }

    const accessToken = app.jwt.sign({ sub: user.id, email: user.email });
    const rawRefresh = app.refreshJwtSign({ sub: user.id, email: user.email });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000);
    await storeRefreshToken(app.db, {
      userId: user.id,
      rawToken: rawRefresh,
      expiresAt,
    });

    return reply.send({
      user: { id: user.id, email: user.email, name: user.name },
      accessToken,
      refreshToken: rawRefresh,
    });
  });

  // POST /auth/refresh
  app.post("/refresh", async (req, reply) => {
    const body = RefreshBody.parse(req.body);

    const tokenRow = await findAndConsumeRefreshToken(app.db, body.refreshToken);
    if (!tokenRow) {
      return reply
        .status(401)
        .send({ error: { code: "INVALID_REFRESH_TOKEN", message: "Token expired or revoked" } });
    }

    const user = await findUserById(app.db, tokenRow.user_id);
    if (!user) {
      return reply
        .status(401)
        .send({ error: { code: "USER_NOT_FOUND", message: "Account not found" } });
    }

    const accessToken = app.jwt.sign({ sub: user.id, email: user.email });
    const newRefresh = app.refreshJwtSign({ sub: user.id, email: user.email });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000);
    await storeRefreshToken(app.db, {
      userId: user.id,
      rawToken: newRefresh,
      expiresAt,
    });

    return reply.send({ accessToken, refreshToken: newRefresh });
  });

  // POST /auth/logout
  app.post(
    "/logout",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      await revokeUserRefreshTokens(app.db, req.user.sub);
      return reply.status(204).send();
    }
  );

  // GET /auth/me
  app.get("/me", { preHandler: [app.authenticate] }, async (req, reply) => {
    const user = await findUserById(app.db, req.user.sub);
    if (!user) {
      return reply
        .status(404)
        .send({ error: { code: "USER_NOT_FOUND", message: "Account not found" } });
    }
    return reply.send({ id: user.id, email: user.email, name: user.name });
  });
};
