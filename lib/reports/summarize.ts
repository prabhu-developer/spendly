import { ExchangeRateService } from "@/lib/currency/exchangeRateService";
import type { SupportedCurrency } from "@/lib/currency/currencies";
import { roundToTwoDecimals } from "@/lib/utils";

export type TxType = "income" | "expense";

/** A server-side aggregated bucket: the raw sum of amounts of one type in one currency. */
export interface CurrencyBucket {
  type: TxType;
  currency: SupportedCurrency;
  amount: number;
}

/**
 * Convert each currency bucket into the target currency and total it per type.
 * Conversion happens once per currency (not per transaction), which avoids
 * accumulating per-row rounding error.
 */
export function totalsByType(
  buckets: CurrencyBucket[],
  target: SupportedCurrency,
  rates: Record<string, number>
): { income: number; expenses: number } {
  let income = 0;
  let expenses = 0;
  for (const bucket of buckets) {
    const converted = ExchangeRateService.convertWithSnapshot(
      bucket.amount,
      bucket.currency,
      target,
      rates
    );
    if (bucket.type === "income") income += converted;
    else expenses += converted;
  }
  return { income: roundToTwoDecimals(income), expenses: roundToTwoDecimals(expenses) };
}

// ---------------------------------------------------------------------------
// Month helpers
// ---------------------------------------------------------------------------

export interface MonthKey {
  /** yyyy-MM, matches Mongo `$dateToString: { format: "%Y-%m" }` */
  key: string;
  /** e.g. "Jan 2026" */
  label: string;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Every calendar month touched by [start, end] (local time), oldest first. */
export function buildMonthKeys(start: Date, end: Date): MonthKey[] {
  const keys: MonthKey[] = [];
  let year = start.getFullYear();
  let month = start.getMonth();
  const endYear = end.getFullYear();
  const endMonth = end.getMonth();
  while (year < endYear || (year === endYear && month <= endMonth)) {
    keys.push({
      key: `${year}-${String(month + 1).padStart(2, "0")}`,
      label: `${MONTH_LABELS[month]} ${year}`,
    });
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return keys;
}

export interface MonthBucket extends CurrencyBucket {
  month: string;
}

export interface CashFlowPoint {
  key: string;
  month: string;
  income: number;
  expenses: number;
  net: number;
}

/** Fill every month in range (zeros where no activity) with converted income/expense/net. */
export function foldCashFlow(
  buckets: MonthBucket[],
  months: MonthKey[],
  target: SupportedCurrency,
  rates: Record<string, number>
): CashFlowPoint[] {
  const byMonth = new Map<string, MonthBucket[]>();
  for (const b of buckets) {
    const list = byMonth.get(b.month) ?? [];
    list.push(b);
    byMonth.set(b.month, list);
  }
  return months.map(({ key, label }) => {
    const totals = totalsByType(byMonth.get(key) ?? [], target, rates);
    return {
      key,
      month: label,
      income: totals.income,
      expenses: totals.expenses,
      net: roundToTwoDecimals(totals.income - totals.expenses),
    };
  });
}

// ---------------------------------------------------------------------------
// Category comparison
// ---------------------------------------------------------------------------

export interface CategoryAmount {
  id: string;
  name: string;
  color: string;
  amount: number;
}

export interface CategoryComparison {
  id: string;
  name: string;
  color: string;
  current: number;
  previous: number;
  change: number;
  /** null when there was no spend in the previous period */
  changePercent: number | null;
}

/** Join current and previous period category spend; sorted by absolute change, largest first. */
export function compareCategories(
  current: CategoryAmount[],
  previous: CategoryAmount[],
  limit = 8
): CategoryComparison[] {
  const map = new Map<string, CategoryComparison>();
  for (const c of current) {
    map.set(c.id, { id: c.id, name: c.name, color: c.color, current: c.amount, previous: 0, change: 0, changePercent: null });
  }
  for (const p of previous) {
    const existing = map.get(p.id);
    if (existing) existing.previous = p.amount;
    else map.set(p.id, { id: p.id, name: p.name, color: p.color, current: 0, previous: p.amount, change: 0, changePercent: null });
  }
  return Array.from(map.values())
    .map((row) => {
      const change = roundToTwoDecimals(row.current - row.previous);
      return {
        ...row,
        current: roundToTwoDecimals(row.current),
        previous: roundToTwoDecimals(row.previous),
        change,
        changePercent: row.previous > 0 ? roundToTwoDecimals((change / row.previous) * 100) : null,
      };
    })
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change) || b.current - a.current)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Recurring expenses
// ---------------------------------------------------------------------------

export interface TitleMonthSeries {
  /** Normalized (lowercase, trimmed) title — grouping key */
  key: string;
  /** Display title (an original spelling) */
  title: string;
  /** Converted spend per month for this title */
  months: { month: string; amount: number; count: number }[];
}

export interface RecurringExpense {
  key: string;
  title: string;
  monthsSeen: number;
  averageAmount: number;
  lastMonth: string;
  /** Coefficient of variation of monthly amounts (0 = identical every month) */
  variation: number;
  /** Estimated yearly cost at the average monthly amount */
  annualizedAmount: number;
}

/**
 * A title is recurring when it appears in at least `minMonths` distinct months
 * and its monthly amounts are stable (coefficient of variation ≤ `maxVariation`).
 */
export function detectRecurring(
  series: TitleMonthSeries[],
  { minMonths = 3, maxVariation = 0.2 }: { minMonths?: number; maxVariation?: number } = {}
): RecurringExpense[] {
  const result: RecurringExpense[] = [];
  for (const s of series) {
    const amounts = new Map<string, number>();
    for (const m of s.months) amounts.set(m.month, (amounts.get(m.month) ?? 0) + m.amount);
    if (amounts.size < minMonths) continue;

    const values = Array.from(amounts.values());
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean <= 0) continue;
    const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
    const cv = Math.sqrt(variance) / mean;
    if (cv > maxVariation) continue;

    result.push({
      key: s.key,
      title: s.title,
      monthsSeen: amounts.size,
      averageAmount: roundToTwoDecimals(mean),
      lastMonth: Array.from(amounts.keys()).sort().at(-1)!,
      variation: roundToTwoDecimals(cv),
      annualizedAmount: roundToTwoDecimals(mean * 12),
    });
  }
  return result.sort((a, b) => b.averageAmount - a.averageAmount);
}

// ---------------------------------------------------------------------------
// Net worth trend
// ---------------------------------------------------------------------------

export interface OpeningBalance {
  /** yyyy-MM of account creation */
  month: string;
  /** Opening balance already converted to the target currency */
  amount: number;
}

export interface NetWorthPoint {
  key: string;
  month: string;
  netWorth: number;
}

/**
 * Month-end net worth = Σ opening balances of accounts created on/before that month
 * + all net flows before the range + cumulative net flows within the range.
 * With no accounts this is simply cumulative income − expenses.
 */
export function foldNetWorthTrend(
  months: MonthKey[],
  monthlyNet: Map<string, number>,
  priorNet: number,
  openings: OpeningBalance[]
): NetWorthPoint[] {
  let running = priorNet;
  return months.map(({ key, label }) => {
    running += monthlyNet.get(key) ?? 0;
    const openingTotal = openings
      .filter((o) => o.month <= key)
      .reduce((acc, o) => acc + o.amount, 0);
    return { key, month: label, netWorth: roundToTwoDecimals(running + openingTotal) };
  });
}

// ---------------------------------------------------------------------------
// Mongo conversion expression
// ---------------------------------------------------------------------------

/** Multiplier converting 1 unit of `from` into `target` using USD-based rates. */
export function conversionFactor(
  from: string,
  target: SupportedCurrency,
  rates: Record<string, number>
): number {
  if (from === target) return 1;
  return (rates[target] || 1) / (rates[from] || 1);
}

/**
 * Mongo expression converting `$amount` (in `$currency`) to the target currency,
 * so groupings that span currencies (merchants, recurring) can be sorted/limited
 * inside the database. Factors come from the same rates as convertWithSnapshot.
 */
export function convertedAmountExpr(
  currencies: readonly string[],
  target: SupportedCurrency,
  rates: Record<string, number>
) {
  return {
    $multiply: [
      "$amount",
      {
        $switch: {
          branches: currencies.map((code) => ({
            case: { $eq: ["$currency", code] },
            then: conversionFactor(code, target, rates),
          })),
          default: 1,
        },
      },
    ],
  };
}
