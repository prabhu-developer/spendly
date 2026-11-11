import { toCsv } from "@/lib/reports/csv";
import type { InsightsResponse, ReportsResponse } from "./types";

/**
 * Build a single multi-section CSV from already-aggregated report data.
 * Sections are separated by a blank line and a section title row so the file
 * stays readable in Excel / Sheets.
 */
export function buildReportCsv(
  report: ReportsResponse,
  insights: InsightsResponse | undefined,
  range: { from: string; to: string }
): string {
  const currency = report.currency;
  const sections: string[] = [];
  const section = (title: string, csv: string) => sections.push(`${title}\r\n${csv}`);

  section(
    `Spendly report ${range.from} to ${range.to} (${currency})`,
    toCsv(
      [
        { metric: "Income", current: report.summary.totalIncome, previous: report.previousSummary.totalIncome, change: report.summary.incomeChange },
        { metric: "Expenses", current: report.summary.totalExpenses, previous: report.previousSummary.totalExpenses, change: report.summary.expensesChange },
        { metric: "Net savings", current: report.summary.totalSavings, previous: report.previousSummary.totalSavings, change: report.summary.savingsChange },
        { metric: "Savings rate (%)", current: report.summary.savingsRate, previous: report.previousSummary.savingsRate, change: "" },
      ],
      [
        { key: "metric", header: "Metric" },
        { key: "current", header: "This period" },
        { key: "previous", header: "Previous period" },
        { key: "change", header: "Change (%)" },
      ],
      { bom: false }
    )
  );

  section(
    "Monthly cash flow",
    toCsv(report.cashFlow as unknown as Record<string, unknown>[], [
      { key: "month", header: "Month" },
      { key: "income", header: "Income" },
      { key: "expenses", header: "Expenses" },
      { key: "net", header: "Net" },
    ], { bom: false })
  );

  section(
    "Expenses by category",
    toCsv(report.categoryBreakdown as unknown as Record<string, unknown>[], [
      { key: "name", header: "Category" },
      { key: "count", header: "Transactions" },
      { key: "amount", header: "Amount" },
      { key: "percentage", header: "Share (%)" },
    ], { bom: false })
  );

  section(
    "Category change vs previous period",
    toCsv(report.categoryComparison as unknown as Record<string, unknown>[], [
      { key: "name", header: "Category" },
      { key: "current", header: "This period" },
      { key: "previous", header: "Previous period" },
      { key: "change", header: "Change" },
      { key: "changePercent", header: "Change (%)" },
    ], { bom: false })
  );

  if (insights) {
    section(
      "Budget performance",
      toCsv(insights.budgets.rows as unknown as Record<string, unknown>[], [
        { key: "name", header: "Category" },
        { key: "budget", header: "Budget" },
        { key: "actual", header: "Actual" },
        { key: "variance", header: "Remaining" },
        { key: "percentage", header: "Used (%)" },
        { key: "months", header: "Months" },
      ], { bom: false })
    );
    section(
      "Top merchants",
      toCsv(insights.merchants as unknown as Record<string, unknown>[], [
        { key: "title", header: "Merchant" },
        { key: "count", header: "Transactions" },
        { key: "total", header: "Total" },
        { key: "average", header: "Average" },
      ], { bom: false })
    );
    section(
      "Recurring expenses",
      toCsv(insights.recurring as unknown as Record<string, unknown>[], [
        { key: "title", header: "Expense" },
        { key: "monthsSeen", header: "Months seen" },
        { key: "averageAmount", header: "Average / month" },
        { key: "annualizedAmount", header: "Annualized" },
        { key: "lastMonth", header: "Last seen" },
      ], { bom: false })
    );
    section(
      "By original currency",
      toCsv(insights.currencies as unknown as Record<string, unknown>[], [
        { key: "currency", header: "Currency" },
        { key: "income", header: "Income (original)" },
        { key: "expenses", header: "Expenses (original)" },
        { key: "convertedIncome", header: `Income (${currency})` },
        { key: "convertedExpenses", header: `Expenses (${currency})` },
        { key: "rate", header: `Rate to ${currency}` },
      ], { bom: false })
    );
    section(
      "Account balances",
      toCsv(insights.netWorth.accounts as unknown as Record<string, unknown>[], [
        { key: "name", header: "Account" },
        { key: "type", header: "Type" },
        { key: "currency", header: "Currency" },
        { key: "balance", header: "Balance" },
        { key: "convertedBalance", header: `Balance (${currency})` },
      ], { bom: false })
    );
    section(
      "Net worth trend",
      toCsv(insights.netWorth.trend as unknown as Record<string, unknown>[], [
        { key: "month", header: "Month" },
        { key: "netWorth", header: "Net worth" },
      ], { bom: false })
    );
    if (insights.isEstimate) {
      sections.push("Note,Converted amounts use estimated (fallback) exchange rates\r\n");
    }
  }

  return "﻿" + sections.join("\r\n");
}
