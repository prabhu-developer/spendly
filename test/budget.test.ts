import { describe, it, expect } from "vitest";
import { roundToTwoDecimals } from "@/lib/utils";

describe("Budget Calculations", () => {
  it("calculates percentage consumed accurately", () => {
    const budgetAmount = 500;
    const spentAmount = 250;

    const percentage = Math.round((spentAmount / budgetAmount) * 100);
    const remaining = Math.max(0, budgetAmount - spentAmount);

    expect(percentage).toBe(50);
    expect(remaining).toBe(250);
  });

  it("handles overrun threshold detection", () => {
    const budgetAmount = 400;
    const spentAmount = 480;

    const percentage = Math.round((spentAmount / budgetAmount) * 100);
    const remaining = Math.max(0, budgetAmount - spentAmount);
    const isExceeded = spentAmount > budgetAmount;

    expect(percentage).toBe(120);
    expect(remaining).toBe(0);
    expect(isExceeded).toBe(true);
  });

  it("handles warning threshold (>= 80%)", () => {
    const budgetAmount = 1000;
    const spentAmount = 850;

    const percentage = Math.round((spentAmount / budgetAmount) * 100);
    const isWarning = percentage >= 80 && spentAmount <= budgetAmount;

    expect(isWarning).toBe(true);
  });

  it("avoids floating point rounding issues in financial calculations", () => {
    const item1 = 0.1;
    const item2 = 0.2;
    const directSum = item1 + item2; // 0.30000000000000004 in raw IEEE 754
    expect(roundToTwoDecimals(directSum)).toBe(0.3);
  });
});
