import { describe, it, expect } from "vitest";
import { createSessionToken, verifySessionToken, SessionPayload } from "@/lib/auth/session";

describe("Session & Token Verification", () => {
  const samplePayload: SessionPayload = {
    userId: "64f1a2b3c4d5e6f7a8b9c0d1",
    email: "user@example.com",
    name: "Test User",
    preferredCurrency: "INR",
  };

  it("creates and verifies a valid signed JWT session token", async () => {
    const token = await createSessionToken(samplePayload);
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");

    const decoded = await verifySessionToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe(samplePayload.userId);
    expect(decoded?.email).toBe(samplePayload.email);
    expect(decoded?.preferredCurrency).toBe("INR");
  });

  it("rejects forged or tampered session tokens", async () => {
    const validToken = await createSessionToken(samplePayload);
    const tampered = validToken.substring(0, validToken.length - 6) + "xxxxxx";

    const result = await verifySessionToken(tampered);
    expect(result).toBeNull();
  });

  it("rejects completely invalid strings", async () => {
    const result = await verifySessionToken("not-a-real-jwt");
    expect(result).toBeNull();
  });

  it("fails closed when the signing secret is missing or too short", async () => {
    const originalSecret = process.env.AUTH_SECRET;
    try {
      delete process.env.AUTH_SECRET;
      await expect(createSessionToken(samplePayload)).rejects.toThrow(
        "AUTH_SECRET must be configured with at least 32 characters"
      );

      process.env.AUTH_SECRET = "short-secret";
      await expect(createSessionToken(samplePayload)).rejects.toThrow(
        "AUTH_SECRET must be configured with at least 32 characters"
      );
    } finally {
      process.env.AUTH_SECRET = originalSecret;
    }
  });
});
