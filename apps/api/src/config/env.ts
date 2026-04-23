import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3001),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),

  // Database
  DATABASE_URL: z.string().url(),

  // JWT — two separate secrets so a compromised access secret doesn't expose refresh tokens
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),

  // CORS
  CORS_ORIGIN: z.string().default("http://localhost:3000"),

  // Registration allowlist — comma-separated domains, e.g. "company.com,contractor.com"
  // Leave unset or empty for open registration.
  ALLOWED_EMAIL_DOMAINS: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(",")
            .map((d) => d.trim().toLowerCase())
            .filter(Boolean)
        : []
    ),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌  Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
