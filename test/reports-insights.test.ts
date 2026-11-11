import { describe, it, expect } from "vitest";
import { escapeCsvCell, toCsv } from "@/lib/reports/csv";
import { resolveReportRange } from "@/lib/reports/range";
import {
  buildMonthKeys,
  compareCategories,
  conversionFactor,
  convertedAmountExpr,
  detectRecurring,
  foldCashFlow,
  foldNetWorthTrend,
  totalsByType,
  type MonthBucket,
} from "@/lib/reports/summarize";
import { ExchangeRateService } from "@/lib/currency/exchangeRateService";
import { roundToTwoDecimals } from "@/lib/utils";

const rates = { USD: 1, INR: 84.25, EUR: 0.92, JPY: 152.4 };

describe("CSV export", () => {
  it("escapes quotes, commas and newlines per RFC 4180", () => {
    expect(escapeCsvCell('Say "hi", ok')).toBe('"Say ""hi"", ok"');
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });

  it("neutralises spreadsheet formula injection", () => {
    expect(escapeCsvCell("=HYPERLINK(\"http://x\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(escapeCsvCell("+cmd")).toBe("'+cmd");
    expect(escapeCsvCell("-2+3")).toBe("'-2+3");
    expect(escapeCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(escapeCsvCell("\tx")).toBe("'\tx");
  });

  it("keeps numbers and numeric strings (incl. negatives) intact", () => {
    expect(escapeCsvCell(-12.5)).toBe("-12.5");
    expect(escapeCsvCell("-12.5")).toBe("-12.5");
    expect(escapeCsvCell(0)).toBe("0");
    expect(escapeCsvCell(Number.NaN)).toBe("");
  });

  it("builds a CSV with optional BOM and CRLF rows", () => {
    const csv = toCsv(
      [{ name: "Café", amount: 10 }, { name: "=bad", amount: -3 }],
      [
        { key: "name", header: "Name" },
        { key: "amount", header: "Amount" },
      ]
    );
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe("﻿Name,Amount\r\nCafé,10\r\n'=bad,-3\r\n");
    expect(toCsv([], [{ key: "a", header: "A" }], { bom: false })).toBe("A\r\n");
  });
});

describe("resolveReportRange", () => {
  const params = (o: Record<string, string>) => new URLSearchParams(o);

  it("defaults to the current month and compares with the whole previous month", () => {
    const r = resolveReportRange(params({}), new Date(2026, 10, 11));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.start).toEqual(new Date(2026, 10, 1));
    expect(r.end.getDate()).toBe(30);
    expect(r.prevEnd.getTime()).toBe(r.start.getTime() - 1);
    // All of October (31 days), not a 30-day window that would skip Oct 1
    expect(r.prevStart).toEqual(new Date(2026, 9, 1));
  });

  it("treats date-only end dates as end of day", () => {
    const r = resolveReportRange(params({ startDate: "2026-01-01", endDate: "2026-01-31" }));
    if (!r.ok) throw new Error("expected ok");
    expect(r.end).toEqual(new Date(2026, 0, 31, 23, 59, 59, 999));
  });

  it("rejects invalid, inverted and over-long ranges", () => {
    expect(resolveReportRange(params({ startDate: "nope" })).ok).toBe(false);
    expect(resolveReportRange(params({ startDate: "2026-02-01", endDate: "2026-01-01" })).ok).toBe(false);
    expect(resolveReportRange(params({ startDate: "2015-01-01", endDate: "2026-01-01" })).ok).toBe(false);
  });
});

describe("buildMonthKeys / foldCashFlow", () => {
  it("lists every month across a year boundary", () => {
    const keys = buildMonthKeys(new Date(2025, 10, 15), new Date(2026, 1, 3));
    expect(keys.map((k) => k.key)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(keys[0].label).toBe("Nov 2025");
  });

  it("fills empty months with zeros and converts per currency", () => {
    const months = buildMonthKeys(new Date(2026, 0, 1), new Date(2026, 2, 31));
    const flow = foldCashFlow(
      [
        { month: "2026-01", type: "income", currency: "USD", amount: 1000 },
        { month: "2026-01", type: "expense", currency: "INR", amount: 8425 },
        { month: "2026-03", type: "expense", currency: "EUR", amount: 92 },
      ],
      months,
      "USD",
      rates
    );
    expect(flow).toEqual([
      { key: "2026-01", month: "Jan 2026", income: 1000, expenses: 100, net: 900 },
      { key: "2026-02", month: "Feb 2026", income: 0, expenses: 0, net: 0 },
      { key: "2026-03", month: "Mar 2026", income: 0, expenses: 100, net: -100 },
    ]);
  });
});

describe("report reconciliation", () => {
  // Fixture buckets as Mongo would return them for one period
  const categoryBuckets = [
    { category: "food", type: "expense" as const, currency: "USD" as const, amount: 123.45 },
    { category: "food", type: "expense" as const, currency: "INR" as const, amount: 5000 },
    { category: "rent", type: "expense" as const, currency: "EUR" as const, amount: 1200.1 },
    { category: "fun", type: "expense" as const, currency: "JPY" as const, amount: 9999 },
    { category: "salary", type: "income" as const, currency: "USD" as const, amount: 5000 },
  ];
  const monthBuckets: MonthBucket[] = [
    { month: "2026-01", type: "expense", currency: "USD", amount: 100 },
    { month: "2026-01", type: "expense", currency: "INR", amount: 5000 },
    { month: "2026-02", type: "expense", currency: "USD", amount: 23.45 },
    { month: "2026-02", type: "expense", currency: "EUR", amount: 1200.1 },
    { month: "2026-02", type: "expense", currency: "JPY", amount: 9999 },
    { month: "2026-02", type: "income", currency: "USD", amount: 5000 },
  ];

  it("category breakdown sums to total expenses within rounding", () => {
    const totals = totalsByType(categoryBuckets, "USD", rates);
    const perCategory = new Map<string, number>();
    for (const b of categoryBuckets) {
      if (b.type !== "expense") continue;
      perCategory.set(
        b.category,
        (perCategory.get(b.category) ?? 0) +
          ExchangeRateService.convertWithSnapshot(b.amount, b.currency, "USD", rates)
      );
    }
    const sum = [...perCategory.values()].map(roundToTwoDecimals).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - totals.expenses)).toBeLessThanOrEqual(0.01 * perCategory.size);
  });

  it("cash flow months sum to the period totals", () => {
    const totals = totalsByType(monthBuckets, "USD", rates);
    const flow = foldCashFlow(monthBuckets, buildMonthKeys(new Date(2026, 0, 1), new Date(2026, 1, 28)), "USD", rates);
    const income = flow.reduce((a, m) => a + m.income, 0);
    const expenses = flow.reduce((a, m) => a + m.expenses, 0);
    expect(roundToTwoDecimals(income)).toBe(totals.income);
    expect(Math.abs(roundToTwoDecimals(expenses) - totals.expenses)).toBeLessThanOrEqual(0.02);
    expect(roundToTwoDecimals(flow.reduce((a, m) => a + m.net, 0))).toBeCloseTo(totals.income - totals.expenses, 1);
  });
});

describe("compareCategories", () => {
  it("joins periods and sorts by absolute change", () => {
    const rows = compareCategories(
      [
        { id: "a", name: "Food", color: "#1", amount: 300 },
        { id: "b", name: "Rent", color: "#2", amount: 1000 },
      ],
      [
        { id: "a", name: "Food", color: "#1", amount: 100 },
        { id: "b", name: "Rent", color: "#2", amount: 1000 },
        { id: "c", name: "Travel", color: "#3", amount: 500 },
      ]
    );
    expect(rows.map((r) => r.id)).toEqual(["c", "a", "b"]);
    expect(rows[0]).toMatchObject({ current: 0, previous: 500, change: -500, changePercent: -100 });
    expect(rows[1]).toMatchObject({ change: 200, changePercent: 200 });
    expect(compareCategories([{ id: "n", name: "New", color: "#", amount: 50 }], [])[0].changePercent).toBeNull();
  });
});

describe("detectRecurring", () => {
  const months = (amounts: number[]) =>
    amounts.map((amount, i) => ({ month: `2026-0${i + 1}`, amount, count: 1 }));

  it("flags stable monthly charges seen in ≥3 months", () => {
    const result = detectRecurring([
      { key: "netflix", title: "Netflix", months: months([15.49, 15.49, 15.49, 15.49]) },
      { key: "gym", title: "Gym", months: months([40, 42, 38]) },
    ]);
    expect(result.map((r) => r.key)).toEqual(["gym", "netflix"]);
    expect(result[1]).toMatchObject({ monthsSeen: 4, averageAmount: 15.49, variation: 0, lastMonth: "2026-04" });
    expect(result[1].annualizedAmount).toBe(185.88);
  });

  it("ignores irregular amounts and too-few months", () => {
    const result = detectRecurring([
      { key: "groceries", title: "Groceries", months: months([50, 210, 90, 400]) },
      { key: "once", title: "Once", months: months([10, 10]) },
    ]);
    expect(result).toEqual([]);
  });

  it("merges duplicate month entries before measuring variation", () => {
    const result = detectRecurring([
      {
        key: "rent",
        title: "Rent",
        months: [
          { month: "2026-01", amount: 500, count: 1 },
          { month: "2026-01", amount: 500, count: 1 },
          { month: "2026-02", amount: 1000, count: 1 },
          { month: "2026-03", amount: 1000, count: 1 },
        ],
      },
    ]);
    expect(result[0]).toMatchObject({ monthsSeen: 3, averageAmount: 1000, variation: 0 });
  });
});

describe("foldNetWorthTrend", () => {
  const months = buildMonthKeys(new Date(2026, 0, 1), new Date(2026, 2, 31));

  it("equals cumulative income − expenses when there are no accounts", () => {
    const trend = foldNetWorthTrend(months, new Map([["2026-01", 500], ["2026-03", -200]]), 1000, []);
    expect(trend.map((p) => p.netWorth)).toEqual([1500, 1500, 1300]);
  });

  it("adds opening balances from the month an account was created", () => {
    const trend = foldNetWorthTrend(months, new Map([["2026-02", 100]]), 0, [
      { month: "2025-06", amount: 2000 },
      { month: "2026-02", amount: -500 },
    ]);
    expect(trend.map((p) => p.netWorth)).toEqual([2000, 1600, 1600]);
  });
});

describe("conversion expression", () => {
  it("uses the same factors as convertWithSnapshot", () => {
    expect(conversionFactor("USD", "USD", rates)).toBe(1);
    expect(100 * conversionFactor("INR", "USD", rates)).toBeCloseTo(
      ExchangeRateService.convertWithSnapshot(100, "INR", "USD", rates),
      2
    );
    const expr = convertedAmountExpr(["USD", "EUR"], "USD", rates);
    expect(expr.$multiply[0]).toBe("$amount");
    const branches = (expr.$multiply[1] as { $switch: { branches: { then: number }[] } }).$switch.branches;
    expect(branches.map((b) => b.then)).toEqual([1, 1 / 0.92]);
  });
});

import { previousPeriod } from "@/lib/reports/range";

describe("previousPeriod", () => {
  const d = (y: number, m: number, day: number, end = false) =>
    end ? new Date(y, m - 1, day, 23, 59, 59, 999) : new Date(y, m - 1, day);

  it("compares a 30-day month with the whole previous 31-day month", () => {
    const { prevStart, prevEnd } = previousPeriod(d(2026, 11, 1), d(2026, 11, 30, true));
    expect(prevStart).toEqual(d(2026, 10, 1));
    expect(prevEnd).toEqual(d(2026, 10, 31, true));
  });

  it("handles February and multi-month ranges", () => {
    expect(previousPeriod(d(2026, 3, 1), d(2026, 3, 31, true))).toEqual({
      prevStart: d(2026, 2, 1),
      prevEnd: d(2026, 2, 28, true),
    });
    expect(previousPeriod(d(2026, 9, 1), d(2026, 11, 30, true))).toEqual({
      prevStart: d(2026, 6, 1),
      prevEnd: d(2026, 8, 31, true),
    });
  });

  it("uses the same number of preceding days for arbitrary ranges", () => {
    expect(previousPeriod(d(2026, 11, 10), d(2026, 11, 16, true))).toEqual({
      prevStart: d(2026, 11, 3),
      prevEnd: d(2026, 11, 9, true),
    });
  });
});
