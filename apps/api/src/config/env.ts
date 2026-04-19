// ── Environment variable validation ───────────────────────────────────────────
// Fail fast at startup if required vars are missing.

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const env = {
  port: Number(process.env["PORT"] ?? 3001),
  nodeEnv: process.env["NODE_ENV"] ?? "development",
  logLevel: process.env["LOG_LEVEL"] ?? "info",
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
} as const;
