import { describe, it, expect } from "vitest";
import { escapeRegex, percentChange } from "@/lib/utils";
import { totalsByType } from "@/lib/reports/summarize";

const rates = { USD: 1, INR: 84.25, EUR: 0.92 };

describe("escapeRegex", () => {
  it("treats regex metacharacters literally", () => {
    const input = "Coffee (Starbucks) $5.00 + tip*";
    const re = new RegExp(escapeRegex(input), "i");
    expect(re.test(input)).toBe(true);
    expect(re.test("Coffee Starbucks 5.00")).toBe(false);
  });

  it("neutralises catastrophic-backtracking patterns", () => {
    const re = new RegExp(escapeRegex("(a+)+$"));
    expect(re.test("aaaaaaaaaaaaaaaaaaaaaaaaaaaa!")).toBe(false);
    expect(re.test("x(a+)+$y")).toBe(true);
  });
});

describe("percentChange", () => {
  it("returns 0 without a baseline", () => {
    expect(percentChange(100, 0)).toBe(0);
  });
  it("computes signed change against the absolute baseline", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(-50, -100)).toBe(50);
  });
});

describe("totalsByType", () => {
  it("converts each currency bucket into the target currency", () => {
    const totals = totalsByType(
      [
        { type: "income", currency: "USD", amount: 1000 },
        { type: "income", currency: "INR", amount: 8425 },
        { type: "expense", currency: "EUR", amount: 92 },
      ],
      "USD",
      rates
    );
    expect(totals).toEqual({ income: 1100, expenses: 100 });
  });

  it("keeps same-currency sums exact (no float drift)", () => {
    const totals = totalsByType(
      [{ type: "expense", currency: "USD", amount: 0.1 + 0.2 }],
      "USD",
      rates
    );
    expect(totals.expenses).toBe(0.3);
    expect(totals.income).toBe(0);
  });

  it("returns zeros for an empty period", () => {
    expect(totalsByType([], "INR", rates)).toEqual({ income: 0, expenses: 0 });
  });
});
