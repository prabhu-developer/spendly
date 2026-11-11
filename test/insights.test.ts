import { describe, it, expect } from "vitest";
import { buildInsights, type InsightInput } from "@/lib/dashboard/insights";

const base: InsightInput = {
  totalIncome: 0,
  totalExpenses: 0,
  savingsRate: 0,
  expensesChange: 0,
  incomeChange: 0,
  dayOfMonth: 15,
  daysInMonth: 30,
  formatMoney: (n) => "$" + n.toFixed(2),
};

describe("buildInsights", () => {
  it("returns nothing for an empty month", () => {
    expect(buildInsights(base)).toEqual([]);
  });

  it("prioritises exceeded budgets and negative savings", () => {
    const ids = buildInsights({
      ...base,
      totalIncome: 1000,
      totalExpenses: 1200,
      savingsRate: -20,
      budgets: { exceeded: 2, nearing: 1, total: 5 },
    }).map((i) => i.id);
    expect(ids.slice(0, 2)).toEqual(["budgets-exceeded", "savings-negative"]);
  });

  it("computes the gap to the 20% savings target from real totals", () => {
    const [insight] = buildInsights({ ...base, totalIncome: 1000, totalExpenses: 900, savingsRate: 10 }, 1);
    expect(insight.id).toBe("savings-low");
    // target savings 200, actual 100 → $100 more
    expect(insight.detail).toContain("$100.00");
  });

  it("projects month spending linearly", () => {
    const projection = buildInsights({ ...base, totalExpenses: 500 }).find((i) => i.id === "projection");
    expect(projection?.title).toContain("$1000.00");
  });

  it("respects the limit", () => {
    expect(
      buildInsights(
        {
          ...base,
          totalIncome: 1000,
          totalExpenses: 700,
          savingsRate: 30,
          expensesChange: 40,
          topCategory: { name: "Rent", percentage: 50 },
          budgets: { exceeded: 1, nearing: 0, total: 3 },
        },
        2
      )
    ).toHaveLength(2);
  });
});
