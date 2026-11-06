import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("Password Hashing & Verification", () => {
  it("generates secure salted bcrypt hashes", async () => {
    const plain = "SecureP@ss123";
    const hash = await hashPassword(plain);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(plain);
    expect(hash.startsWith("$2")).toBe(true); // bcrypt prefix
  });

  it("successfully verifies valid passwords", async () => {
    const plain = "MySecret123!";
    const hash = await hashPassword(plain);

    const isValid = await verifyPassword(plain, hash);
    expect(isValid).toBe(true);
  });

  it("rejects invalid passwords", async () => {
    const plain = "CorrectPass123";
    const hash = await hashPassword(plain);

    const isWrong = await verifyPassword("WrongPassword!", hash);
    expect(isWrong).toBe(false);
  });
});
