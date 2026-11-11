import { z } from "zod";

const AUTH_SECRET_MESSAGE = "AUTH_SECRET must be configured with at least 32 characters";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGODB_URI: z
    .string({ error: "MONGODB_URI is required" })
    .min(1, "MONGODB_URI is required")
    .refine((v) => /^mongodb(\+srv)?:\/\//.test(v), "MONGODB_URI must start with mongodb:// or mongodb+srv://"),
  MONGODB_DB_NAME: z.string().min(1).default("spendly"),
  AUTH_SECRET: z.string({ error: AUTH_SECRET_MESSAGE }).min(32, AUTH_SECRET_MESSAGE),
  EXCHANGE_RATE_API_KEY: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.url("NEXT_PUBLIC_APP_URL must be a valid URL").optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export class EnvValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid server environment configuration:\n - ${issues.join("\n - ")}`);
    this.name = "EnvValidationError";
  }
}

/** Treat empty strings as unset so `KEY=""` in .env files behaves like a missing optional. */
function readRawEnv(source: NodeJS.ProcessEnv) {
  const pick = (key: string) => {
    const value = source[key];
    return value === undefined || value.trim() === "" ? undefined : value.trim();
  };
  return {
    NODE_ENV: pick("NODE_ENV"),
    MONGODB_URI: pick("MONGODB_URI"),
    MONGODB_DB_NAME: pick("MONGODB_DB_NAME"),
    AUTH_SECRET: pick("AUTH_SECRET"),
    EXCHANGE_RATE_API_KEY: pick("EXCHANGE_RATE_API_KEY"),
    NEXT_PUBLIC_APP_URL: pick("NEXT_PUBLIC_APP_URL"),
  };
}

/**
 * Validate an environment object. Error messages name the variable and the
 * problem but never include the value (secrets must not reach logs).
 */
export function parseServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const result = serverEnvSchema.safeParse(readRawEnv(source));
  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const key = issue.path.join(".") || "env";
      return issue.message.includes(key) ? issue.message : `${key}: ${issue.message}`;
    });
    throw new EnvValidationError(issues);
  }
  return result.data;
}

let cached: ServerEnv | null = null;

/**
 * Lazily validated server env. Validation happens on first use (a request),
 * never at import time, so `next build` works without database credentials.
 * Cached in production; re-read elsewhere so tests can mutate process.env.
 */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const env = parseServerEnv();
  if (env.NODE_ENV === "production") cached = env;
  return env;
}

/** Only the auth secret — lets JWT signing fail with a precise message without requiring DB config. */
export function getAuthSecretValue(source: NodeJS.ProcessEnv = process.env): string {
  const parsed = serverEnvSchema.shape.AUTH_SECRET.safeParse(readRawEnv(source).AUTH_SECRET);
  if (!parsed.success) throw new EnvValidationError([AUTH_SECRET_MESSAGE]);
  return parsed.data;
}
