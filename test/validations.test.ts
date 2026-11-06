import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema } from "@/lib/validations/auth";
import { transactionSchema } from "@/lib/validations/transaction";
import { budgetSchema } from "@/lib/validations/budget";
import { categorySchema } from "@/lib/validations/category";

describe("Input Validations (Zod)", () => {
  describe("Registration Validation", () => {
    it("accepts valid registration input", () => {
      const valid = {
        name: "Prabhu",
        email: "prabhu@example.com",
        password: "Password123",
        preferredCurrency: "INR",
      };
      const result = registerSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects weak passwords missing uppercase or number", () => {
      const invalid = {
        name: "Prabhu",
        email: "prabhu@example.com",
        password: "password", // no uppercase or number
        preferredCurrency: "USD",
      };
      const result = registerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects malformed email addresses", () => {
      const invalid = {
        name: "Prabhu",
        email: "not-an-email",
        password: "Password123",
        preferredCurrency: "USD",
      };
      const result = registerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("Transaction Validation", () => {
    it("validates correct transaction data", () => {
      const valid = {
        title: "Grocery Shopping",
        amount: 85.5,
        currency: "USD",
        type: "expense",
        categoryId: "64f1a2b3c4d5e6f7a8b9c0d1",
        date: "2026-11-06",
        paymentMethod: "Credit Card",
        notes: "Whole Foods purchase",
      };
      const result = transactionSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects non-positive transaction amounts", () => {
      const invalid = {
        title: "Refund",
        amount: -10,
        currency: "USD",
        type: "expense",
        categoryId: "64f1a2b3c4d5e6f7a8b9c0d1",
        date: "2026-11-06",
      };
      const result = transactionSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("Budget & Category Validation", () => {
    it("validates category color and name", () => {
      const valid = {
        name: "Software Subscriptions",
        type: "expense",
        icon: "Laptop",
        color: "#2878E5",
      };
      expect(categorySchema.safeParse(valid).success).toBe(true);

      const invalidColor = { ...valid, color: "blue" }; // not hex
      expect(categorySchema.safeParse(invalidColor).success).toBe(false);
    });

    it("validates budget month range and positive limit", () => {
      const valid = {
        categoryId: "64f1a2b3c4d5e6f7a8b9c0d1",
        amount: 600,
        currency: "USD",
        month: 11,
        year: 2026,
      };
      expect(budgetSchema.safeParse(valid).success).toBe(true);

      const invalidMonth = { ...valid, month: 13 };
      expect(budgetSchema.safeParse(invalidMonth).success).toBe(false);
    });
  });
});
