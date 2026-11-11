"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Repeat, Store } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency/currencies";
import { cn } from "@/lib/utils";
import { ChartTooltip, CHART_COLORS, compactAxisFormatter } from "./chartKit";
import { transactionsDrillDownHref, type InsightsResponse } from "./types";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: "Checking",
  savings: "Savings",
  credit_card: "Credit card",
  cash: "Cash",
  investment: "Investment",
  loan: "Loan",
  wallet: "Wallet",
  other: "Other",
};

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[8rem] items-center justify-center rounded-lg border border-dashed border-border px-4 text-center text-xs text-muted-foreground">
      {children}
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th scope="col" className={cn("px-2 pb-2.5 font-medium", right && "text-right")}>
      {children}
    </th>
  );
}

export function InsightsSections({
  insights,
  range,
}: {
  insights: InsightsResponse;
  range: { from: string; to: string };
}) {
  const currency = insights.currency;
  const money = (v: number, c = currency) => formatCurrency(v, c);
  const { netWorth, budgets } = insights;
  const hasAccounts = netWorth.accounts.length > 0;
  const budgetPct = budgets.totalBudget > 0 ? Math.round((budgets.totalActual / budgets.totalBudget) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Net worth */}
      <Card className="break-inside-avoid print:break-before-page">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Net worth</CardTitle>
              <CardDescription className="text-xs">
                Month-end net worth: account opening balances plus all recorded income and expenses.
              </CardDescription>
            </div>
            <dl className="grid grid-cols-3 gap-4 text-right sm:gap-6">
              <div>
                <dt className="text-[11px] text-muted-foreground">Assets</dt>
                <dd className="text-sm font-semibold tabular-nums text-income-text">{money(netWorth.assets)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">Liabilities</dt>
                <dd className="text-sm font-semibold tabular-nums text-expense-text">{money(netWorth.liabilities)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">Net worth today</dt>
                <dd className="text-sm font-semibold tabular-nums text-main">{money(netWorth.current)}</dd>
              </div>
            </dl>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="h-56 w-full" role="img" aria-label="Net worth trend chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={netWorth.trend} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
                <defs>
                  <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_COLORS.grid} />
                <XAxis dataKey="month" stroke={CHART_COLORS.axis} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  stroke={CHART_COLORS.axis}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={compactAxisFormatter}
                />
                <Tooltip content={<ChartTooltip currency={currency} />} />
                <Area
                  type="monotone"
                  dataKey="netWorth"
                  name="Net worth"
                  stroke={CHART_COLORS.primary}
                  strokeWidth={2.25}
                  fill="url(#netWorthFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {hasAccounts ? (
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">Account balances</caption>
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <Th>Account</Th>
                    <Th>Type</Th>
                    <Th right>Balance</Th>
                    <Th right>In {currency}</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {netWorth.accounts.map((a) => (
                    <tr key={a.id} className={cn(a.isArchived && "text-muted-foreground")}>
                      <td className="px-2 py-2.5 font-medium text-main">
                        <Link
                          href={transactionsDrillDownHref({ accountId: a.id, startDate: range.from, endDate: range.to })}
                          className="inline-flex items-center gap-2 rounded hover:text-primary-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: a.color }} />
                          {a.name}
                          {a.isArchived && <span className="text-[11px] font-normal text-muted-foreground">(archived)</span>}
                        </Link>
                      </td>
                      <td className="px-2 py-2.5 text-muted-foreground">{ACCOUNT_TYPE_LABELS[a.type] ?? a.type}</td>
                      <td
                        className={cn(
                          "px-2 py-2.5 text-right tabular-nums",
                          a.balance < 0 ? "text-expense-text" : "text-main"
                        )}
                      >
                        {money(a.balance, a.currency)}
                      </td>
                      <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-main">
                        {money(a.convertedBalance)}
                      </td>
                    </tr>
                  ))}
                  {netWorth.unassignedBalance !== 0 && (
                    <tr>
                      <td className="px-2 py-2.5 text-muted-foreground" colSpan={3}>
                        Transactions not linked to an account
                      </td>
                      <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-main">
                        {money(netWorth.unassignedBalance)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
              No accounts yet, so net worth is your cumulative income minus expenses.{" "}
              <Link href="/dashboard/accounts" className="font-medium text-primary-text hover:underline print:hidden">
                Add accounts
              </Link>{" "}
              to include opening balances and see per-account totals.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Budget performance */}
      <Card className="break-inside-avoid">
        <CardHeader className="pb-2">
          <CardTitle>Budget performance</CardTitle>
          <CardDescription className="text-xs">
            Budget vs actual spending for each budgeted month in this period (whole months).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {budgets.rows.length === 0 ? (
            <Empty>
              <span>
                No budgets set for these months.{" "}
                <Link href="/dashboard/budgets" className="font-medium text-primary-text hover:underline">
                  Create a budget
                </Link>
              </span>
            </Empty>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  <span className="font-semibold tabular-nums text-main">{money(budgets.totalActual)}</span> spent of{" "}
                  <span className="font-semibold tabular-nums text-main">{money(budgets.totalBudget)}</span> budgeted
                </span>
                <span className={cn("font-semibold tabular-nums", budgetPct > 100 ? "text-expense-text" : "text-income-text")}>
                  {budgetPct}% used
                </span>
              </div>
              <ul className="space-y-3">
                {budgets.rows.map((row) => {
                  const over = row.actual > row.budget;
                  return (
                    <li key={row.id} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="flex min-w-0 items-center gap-2 font-medium text-main">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                          <span className="truncate">{row.name}</span>
                          {row.overMonths > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-expense-light px-1.5 py-0.5 text-[10px] font-medium text-expense-text">
                              <AlertTriangle className="h-3 w-3" aria-hidden />
                              Over in {row.overMonths} of {row.months} {row.months === 1 ? "month" : "months"}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          <span className={cn("font-semibold", over ? "text-expense-text" : "text-main")}>
                            {money(row.actual)}
                          </span>{" "}
                          / {money(row.budget)}
                        </span>
                      </div>
                      <div
                        className="h-2 overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-label={`${row.name} budget used`}
                        aria-valuenow={row.percentage}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className={cn("h-full rounded-full", over ? "bg-expense" : row.percentage >= 80 ? "bg-warning" : "bg-income")}
                          style={{ width: `${Math.min(100, row.percentage)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Merchants */}
        <Card className="break-inside-avoid">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Store className="h-4 w-4 text-muted-foreground" aria-hidden />
              Top merchants
            </CardTitle>
            <CardDescription className="text-xs">Where you spent the most, grouped by transaction title.</CardDescription>
          </CardHeader>
          <CardContent>
            {insights.merchants.length === 0 ? (
              <Empty>No expenses in this period.</Empty>
            ) : (
              <div className="-mx-2 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <Th>Merchant</Th>
                      <Th right>Txns</Th>
                      <Th right>Average</Th>
                      <Th right>Total</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {insights.merchants.map((m) => (
                      <tr key={m.key}>
                        <td className="max-w-[12rem] px-2 py-2.5 font-medium text-main">
                          <Link
                            href={transactionsDrillDownHref({ search: m.title.trim(), type: "expense", startDate: range.from, endDate: range.to })}
                            className="block truncate rounded hover:text-primary-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                          >
                            {m.title}
                          </Link>
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">{m.count}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">{money(m.average)}</td>
                        <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-main">{money(m.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recurring */}
        <Card className="break-inside-avoid">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Repeat className="h-4 w-4 text-muted-foreground" aria-hidden />
              Recurring expenses
            </CardTitle>
            <CardDescription className="text-xs">
              Charges with a stable amount in at least 3 of the 6 months ending{" "}
              {format(parseISO(insights.recurringWindow.endDate), "MMM yyyy")}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {insights.recurring.length === 0 ? (
              <Empty>No recurring expenses detected yet.</Empty>
            ) : (
              <div className="-mx-2 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <Th>Expense</Th>
                      <Th right>Months</Th>
                      <Th right>Per month</Th>
                      <Th right>Per year</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {insights.recurring.map((r) => (
                      <tr key={r.key}>
                        <td className="max-w-[12rem] truncate px-2 py-2.5 font-medium text-main">{r.title}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">{r.monthsSeen}/6</td>
                        <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-main">{money(r.averageAmount)}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">{money(r.annualizedAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border">
                      <td className="px-2 pt-2.5 font-medium text-muted-foreground" colSpan={2}>
                        Total
                      </td>
                      <td className="px-2 pt-2.5 text-right font-semibold tabular-nums text-main">
                        {money(insights.recurring.reduce((a, r) => a + r.averageAmount, 0))}
                      </td>
                      <td className="px-2 pt-2.5 text-right font-semibold tabular-nums text-main">
                        {money(insights.recurring.reduce((a, r) => a + r.annualizedAmount, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Currencies */}
      <Card className="break-inside-avoid">
        <CardHeader className="pb-2">
          <CardTitle>By original currency</CardTitle>
          <CardDescription className="text-xs">
            Amounts as recorded, and converted to {currency} at the rates used in this report.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {insights.isEstimate && (
            <p role="note" className="flex items-start gap-2 rounded-lg bg-warning-light px-3 py-2 text-xs text-warning-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Live exchange rates are unavailable, so converted totals use estimated rates and may differ slightly.
            </p>
          )}
          {insights.currencies.length === 0 ? (
            <Empty>No transactions in this period.</Empty>
          ) : (
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <Th>Currency</Th>
                    <Th right>Income</Th>
                    <Th right>Expenses</Th>
                    <Th right>Income ({currency})</Th>
                    <Th right>Expenses ({currency})</Th>
                    <Th right>Rate</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {insights.currencies.map((c) => (
                    <tr key={c.currency}>
                      <td className="px-2 py-2.5 font-medium text-main">{c.currency}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">{money(c.income, c.currency)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">{money(c.expenses, c.currency)}</td>
                      <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-income-text">{money(c.convertedIncome)}</td>
                      <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-expense-text">{money(c.convertedExpenses)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                        {c.currency === currency ? "—" : c.rate.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Rates updated {format(parseISO(insights.ratesUpdatedAt), "dd MMM yyyy, HH:mm")}.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
