"use client";

import { useRouter } from "next/navigation";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, ChevronRight, Minus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency/currencies";
import { cn } from "@/lib/utils";
import { ChartTooltip, CHART_COLORS, compactAxisFormatter } from "@/features/reports/chartKit";
import {
  transactionsDrillDownHref,
  type CashFlowPoint,
  type CategoryBreakdownItem,
  type CategoryComparisonItem,
} from "@/features/reports/types";

interface ReportChartsProps {
  cashFlow: CashFlowPoint[];
  categoryBreakdown: CategoryBreakdownItem[];
  categoryComparison: CategoryComparisonItem[];
  currency: string;
  range: { from: string; to: string };
}

function SectionEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-[10rem] items-center justify-center rounded-lg border border-dashed border-border px-4 text-center text-xs text-muted-foreground">
      {children}
    </div>
  );
}

export function ReportCharts({
  cashFlow,
  categoryBreakdown,
  categoryComparison,
  currency,
  range,
}: ReportChartsProps) {
  const router = useRouter();
  const hasFlow = cashFlow.some((m) => m.income !== 0 || m.expenses !== 0);
  const drillDown = (categoryId: string) => {
    if (categoryId === "other") return; // "Other" groups deleted categories; nothing to filter on
    router.push(
      transactionsDrillDownHref({ categoryId, type: "expense", startDate: range.from, endDate: range.to })
    );
  };

  return (
    <div className="space-y-6">
      {/* Cash flow */}
      <Card className="break-inside-avoid">
        <CardHeader className="pb-2">
          <CardTitle>Income vs expenses</CardTitle>
          <CardDescription className="text-xs">
            Monthly cash flow for the selected period — bars show income and expenses, the line shows net.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasFlow ? (
            <>
              <div className="h-72 w-full" role="img" aria-label="Monthly income, expenses and net cash flow chart">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={cashFlow} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_COLORS.grid} />
                    <XAxis dataKey="month" stroke={CHART_COLORS.axis} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis
                      stroke={CHART_COLORS.axis}
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={56}
                      tickFormatter={compactAxisFormatter(currency)}
                    />
                    <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ fill: "rgba(40,120,229,0.06)" }} />
                    <Legend wrapperStyle={{ paddingTop: 12, fontSize: 12 }} iconType="circle" iconSize={8} />
                    <Bar dataKey="income" name="Income" fill={CHART_COLORS.income} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="expenses" name="Expenses" fill={CHART_COLORS.expense} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Line
                      type="monotone"
                      dataKey="net"
                      name="Net"
                      stroke={CHART_COLORS.primary}
                      strokeWidth={2.25}
                      dot={{ r: 3, fill: CHART_COLORS.primary }}
                      activeDot={{ r: 5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              {/* Screen-reader / print equivalent of the chart */}
              <table className="sr-only">
                <caption>Monthly cash flow</caption>
                <thead>
                  <tr>
                    <th scope="col">Month</th>
                    <th scope="col">Income</th>
                    <th scope="col">Expenses</th>
                    <th scope="col">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {cashFlow.map((m) => (
                    <tr key={m.key}>
                      <th scope="row">{m.month}</th>
                      <td>{formatCurrency(m.income, currency)}</td>
                      <td>{formatCurrency(m.expenses, currency)}</td>
                      <td>{formatCurrency(m.net, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <SectionEmpty>No income or expenses recorded in this period.</SectionEmpty>
          )}
        </CardContent>
      </Card>

      {/* Category breakdown + distribution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="break-inside-avoid lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle>Expenses by category</CardTitle>
            <CardDescription className="text-xs">
              Select a category to see its transactions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {categoryBreakdown.length === 0 ? (
              <SectionEmpty>No expenses logged in this period.</SectionEmpty>
            ) : (
              <div className="-mx-2 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th scope="col" className="px-2 pb-2.5 font-medium">Category</th>
                      <th scope="col" className="px-2 pb-2.5 text-right font-medium">Transactions</th>
                      <th scope="col" className="px-2 pb-2.5 text-right font-medium">Amount</th>
                      <th scope="col" className="w-[28%] px-2 pb-2.5 font-medium">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {categoryBreakdown.map((category) => {
                      const clickable = category.id !== "other";
                      return (
                        <tr
                          key={category.id}
                          className={cn("group", clickable && "cursor-pointer hover:bg-muted/60")}
                          onClick={clickable ? () => drillDown(category.id) : undefined}
                        >
                          <td className="px-2 py-2.5 font-medium text-main">
                            {clickable ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  drillDown(category.id);
                                }}
                                className="inline-flex items-center gap-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                                aria-label={`View ${category.name} transactions`}
                              >
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                                {category.name}
                                <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 print:hidden" />
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-2">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                                {category.name}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">{category.count}</td>
                          <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-main">
                            {formatCurrency(category.amount, currency)}
                          </td>
                          <td className="px-2 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${Math.min(100, category.percentage)}%`, backgroundColor: category.color }}
                                />
                              </div>
                              <span className="w-12 text-right tabular-nums text-muted-foreground">{category.percentage}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="break-inside-avoid">
          <CardHeader className="pb-2">
            <CardTitle>Distribution</CardTitle>
            <CardDescription className="text-xs">Share of total spending</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryBreakdown.length > 0 ? (
              <div className="h-64 w-full" role="img" aria-label="Category share of spending chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={88}
                      paddingAngle={2}
                      stroke="#fff"
                      strokeWidth={2}
                      onClick={(entry: { id?: string }) => entry?.id && drillDown(entry.id)}
                      className="cursor-pointer focus:outline-none"
                    >
                      {categoryBreakdown.map((entry) => (
                        <Cell key={entry.id} fill={entry.color || CHART_COLORS.primary} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip currency={currency} showPercentOf={categoryBreakdown.reduce((a, c) => a + c.amount, 0)} />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <SectionEmpty>No data to display.</SectionEmpty>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Period comparison by category */}
      <Card className="break-inside-avoid">
        <CardHeader className="pb-2">
          <CardTitle>Spending change by category</CardTitle>
          <CardDescription className="text-xs">
            Largest movements compared with the previous period of the same length.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {categoryComparison.length === 0 ? (
            <SectionEmpty>No expenses in either period to compare.</SectionEmpty>
          ) : (
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th scope="col" className="px-2 pb-2.5 font-medium">Category</th>
                    <th scope="col" className="px-2 pb-2.5 text-right font-medium">Previous</th>
                    <th scope="col" className="px-2 pb-2.5 text-right font-medium">This period</th>
                    <th scope="col" className="px-2 pb-2.5 text-right font-medium">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {categoryComparison.map((row) => {
                    const up = row.change > 0;
                    const down = row.change < 0;
                    return (
                      <tr key={row.id}>
                        <td className="px-2 py-2.5 font-medium text-main">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                            {row.name}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                          {formatCurrency(row.previous, currency)}
                        </td>
                        <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-main">
                          {formatCurrency(row.current, currency)}
                        </td>
                        <td
                          className={cn(
                            "px-2 py-2.5 text-right font-medium tabular-nums",
                            // More spending is unfavourable
                            up && "text-expense-text",
                            down && "text-income-text",
                            !up && !down && "text-muted-foreground"
                          )}
                        >
                          <span className="inline-flex items-center gap-0.5">
                            {up && <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />}
                            {down && <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />}
                            {!up && !down && <Minus className="h-3.5 w-3.5" aria-hidden />}
                            {formatCurrency(row.change, currency, true)}
                            {row.changePercent !== null && (
                              <span className="ml-1 text-muted-foreground">({Math.abs(row.changePercent)}%)</span>
                            )}
                            {row.changePercent === null && row.current > 0 && (
                              <span className="ml-1 text-muted-foreground">(new)</span>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
