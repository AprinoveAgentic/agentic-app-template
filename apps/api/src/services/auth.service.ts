import { createHash } from "node:crypto";
import argon2 from "argon2";
import type { Pool } from "pg";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked: boolean;
  created_at: Date;
}

// ── Argon2 config (OWASP interactive login minimum) ───────────────────────────
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65_536, // 64 MiB
  timeCost: 3,
  parallelism: 4,
};

const DUMMY_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$dummysaltdummysaltdummy$dummyhash000000000000000000000000000000000";

// ── Password helpers ──────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

/** Constant-time dummy verify to prevent user enumeration via timing. */
export async function dummyVerify(): Promise<void> {
  await argon2.verify(DUMMY_HASH, "dummy-password").catch(() => false);
}

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

// ── User operations ───────────────────────────────────────────────────────────

export async function createUser(
  db: Pool,
  opts: { email: string; password: string; name?: string | undefined }
): Promise<UserRow> {
  const passwordHash = await hashPassword(opts.password);
  const { rows } = await db.query<UserRow>(
    `INSERT INTO users (email, password_hash, name)
     VALUES ($1, $2, $3)
     RETURNING id, email, name, password_hash, created_at, updated_at`,
    [opts.email.toLowerCase(), passwordHash, opts.name ?? null]
  );
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return rows[0]!;
}

export async function findUserByEmail(db: Pool, email: string): Promise<UserRow | null> {
  const { rows } = await db.query<UserRow>(
    `SELECT id, email, name, password_hash, created_at, updated_at
     FROM users WHERE email = $1`,
    [email.toLowerCase()]
  );
  return rows[0] ?? null;
}

export async function findUserById(db: Pool, id: string): Promise<UserRow | null> {
  const { rows } = await db.query<UserRow>(
    `SELECT id, email, name, password_hash, created_at, updated_at
     FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

// ── Refresh token operations ──────────────────────────────────────────────────

export async function storeRefreshToken(
  db: Pool,
  opts: { userId: string; rawToken: string; expiresAt: Date }
): Promise<void> {
  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [opts.userId, hashToken(opts.rawToken), opts.expiresAt]
  );
}

export async function findAndConsumeRefreshToken(
  db: Pool,
  rawToken: string
): Promise<RefreshTokenRow | null> {
  const { rows } = await db.query<RefreshTokenRow>(
    `UPDATE refresh_tokens
     SET revoked = true
     WHERE token_hash = $1
       AND expires_at > NOW()
       AND revoked = false
     RETURNING id, user_id, token_hash, expires_at, revoked, created_at`,
    [hashToken(rawToken)]
  );
  return rows[0] ?? null;
}

export async function revokeUserRefreshTokens(db: Pool, userId: string): Promise<void> {
  await db.query(
    `UPDATE refresh_tokens SET revoked = true
     WHERE user_id = $1 AND revoked = false`,
    [userId]
  );
}
