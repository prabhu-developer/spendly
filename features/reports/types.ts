import type { AccountType } from "@/models/Account";

export interface ReportSummary {
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  savingsRate: number;
  incomeChange: number;
  expensesChange: number;
  savingsChange: number;
}

export interface CategoryBreakdownItem {
  id: string;
  name: string;
  color: string;
  amount: number;
  percentage: number;
  count: number;
}

export interface CategoryComparisonItem {
  id: string;
  name: string;
  color: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number | null;
}

export interface CashFlowPoint {
  key: string;
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export interface ReportsResponse {
  success: true;
  currency: string;
  isEstimate?: boolean;
  summary: ReportSummary;
  previousSummary: Pick<ReportSummary, "totalIncome" | "totalExpenses" | "totalSavings" | "savingsRate">;
  categoryBreakdown: CategoryBreakdownItem[];
  categoryComparison: CategoryComparisonItem[];
  cashFlow: CashFlowPoint[];
  period: { startDate: string; endDate: string };
  previousPeriod: { startDate: string; endDate: string };
}

export interface InsightsResponse {
  success: true;
  currency: string;
  isEstimate: boolean;
  ratesUpdatedAt: string;
  merchants: { key: string; title: string; total: number; count: number; average: number }[];
  recurring: {
    key: string;
    title: string;
    monthsSeen: number;
    averageAmount: number;
    lastMonth: string;
    variation: number;
    annualizedAmount: number;
  }[];
  recurringWindow: { startDate: string; endDate: string };
  currencies: {
    currency: string;
    income: number;
    expenses: number;
    convertedIncome: number;
    convertedExpenses: number;
    count: number;
    rate: number;
  }[];
  budgets: {
    rows: {
      id: string;
      name: string;
      color: string;
      budget: number;
      actual: number;
      variance: number;
      percentage: number;
      months: number;
      overMonths: number;
    }[];
    totalBudget: number;
    totalActual: number;
  };
  netWorth: {
    current: number;
    assets: number;
    liabilities: number;
    unassignedBalance: number;
    accounts: {
      id: string;
      name: string;
      type: AccountType;
      currency: string;
      color: string;
      isArchived: boolean;
      balance: number;
      convertedBalance: number;
    }[];
    trend: { key: string; month: string; netWorth: number }[];
  };
}

/** Transactions page drill-down URL (params read by the transactions page). */
export function transactionsDrillDownHref(params: {
  categoryId?: string;
  type?: "income" | "expense";
  accountId?: string;
  search?: string;
  startDate: string;
  endDate: string;
}): string {
  const search = new URLSearchParams();
  if (params.categoryId) search.set("categoryId", params.categoryId);
  if (params.type) search.set("type", params.type);
  if (params.accountId) search.set("accountId", params.accountId);
  if (params.search) search.set("search", params.search);
  search.set("startDate", params.startDate);
  search.set("endDate", params.endDate);
  return `/dashboard/transactions?${search.toString()}`;
}
