import { describe, it, expect } from "vitest";
import { parseServerEnv, getAuthSecretValue, EnvValidationError } from "@/lib/env";

const valid = {
  NODE_ENV: "test",
  MONGODB_URI: "mongodb://localhost:27017/x",
  AUTH_SECRET: "a".repeat(32),
} as NodeJS.ProcessEnv;

describe("server env validation", () => {
  it("accepts a minimal valid configuration and applies defaults", () => {
    const env = parseServerEnv(valid);
    expect(env.MONGODB_DB_NAME).toBe("spendly");
    expect(env.EXCHANGE_RATE_API_KEY).toBeUndefined();
  });

  it("treats empty strings as unset for optional values", () => {
    const env = parseServerEnv({ ...valid, EXCHANGE_RATE_API_KEY: "", NEXT_PUBLIC_APP_URL: "  " });
    expect(env.EXCHANGE_RATE_API_KEY).toBeUndefined();
    expect(env.NEXT_PUBLIC_APP_URL).toBeUndefined();
  });

  it("aggregates every problem into one error", () => {
    try {
      parseServerEnv({ NODE_ENV: "test", NEXT_PUBLIC_APP_URL: "not a url" } as NodeJS.ProcessEnv);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const message = (error as Error).message;
      expect(message).toContain("MONGODB_URI");
      expect(message).toContain("AUTH_SECRET must be configured with at least 32 characters");
      expect(message).toContain("NEXT_PUBLIC_APP_URL");
    }
  });

  it("rejects a short secret without echoing its value", () => {
    const secret = "short-but-sensitive";
    try {
      parseServerEnv({ ...valid, AUTH_SECRET: secret });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).toContain("AUTH_SECRET");
      expect((error as Error).message).not.toContain(secret);
    }
  });

  it("rejects a non-mongodb connection string without echoing it", () => {
    const uri = "postgres://user:pass@host/db";
    expect(() => parseServerEnv({ ...valid, MONGODB_URI: uri })).toThrow(/MONGODB_URI/);
    try {
      parseServerEnv({ ...valid, MONGODB_URI: uri });
    } catch (error) {
      expect((error as Error).message).not.toContain("pass@host");
    }
  });

  it("validates the auth secret independently of database config", () => {
    expect(getAuthSecretValue({ AUTH_SECRET: "b".repeat(40) } as unknown as NodeJS.ProcessEnv)).toHaveLength(40);
    expect(() => getAuthSecretValue({} as NodeJS.ProcessEnv)).toThrow(
      "AUTH_SECRET must be configured with at least 32 characters"
    );
  });
});
