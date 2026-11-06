import { describe, it, expect } from "vitest";
import { createSessionToken, verifySessionToken, SessionPayload } from "@/lib/auth/session";

describe("Session & Token Verification", () => {
  const samplePayload: SessionPayload = {
    userId: "64f1a2b3c4d5e6f7a8b9c0d1",
    email: "user@example.com",
    name: "Test User",
    preferredCurrency: "USD",
  };

  it("creates and verifies a valid signed JWT session token", async () => {
    const token = await createSessionToken(samplePayload);
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");

    const decoded = await verifySessionToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe(samplePayload.userId);
    expect(decoded?.email).toBe(samplePayload.email);
    expect(decoded?.preferredCurrency).toBe("USD");
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
});
