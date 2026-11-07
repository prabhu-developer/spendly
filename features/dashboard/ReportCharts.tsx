"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency, SupportedCurrency } from "@/lib/currency/currencies";

interface MonthlyTrend {
  month: string;
  income: number;
  expenses: number;
  savings: number;
}

interface CategoryBreakdown {
  name: string;
  color: string;
  amount: number;
  percentage: number;
  count: number;
}

interface ReportChartsProps {
  monthlyTrends: MonthlyTrend[];
  categoryBreakdown: CategoryBreakdown[];
  currency: SupportedCurrency | string;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    color?: string;
    stroke?: string;
    name?: string;
    value?: number;
  }>;
  label?: string;
}

export function ReportCharts({
  monthlyTrends,
  categoryBreakdown,
  currency,
}: ReportChartsProps) {
  const customTooltip = ({ active, payload, label }: TooltipProps) => {
    if (!active || !payload?.length) return null;

    return (
      <div className="rounded-lg border border-[#E8EDF4] bg-white p-3 shadow-lg">
        <p className="mb-1 text-xs font-semibold text-[#202735]">{label}</p>
        {payload.map((entry, index) => (
          <div key={`item-${index}`} className="flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color || entry.stroke }}
            />
            <span className="text-[#8992A3]">{entry.name}:</span>
            <span className="font-semibold text-[#202735]">
              {formatCurrency(entry.value ?? 0, currency)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border border-[#E8EDF4]">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Income vs Expense Comparison
            </CardTitle>
            <CardDescription className="text-xs">
              Past 6 months overview
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyTrends}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#E8EDF4"
                  />
                  <XAxis
                    dataKey="month"
                    stroke="#8992A3"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis stroke="#8992A3" fontSize={11} tickLine={false} />
                  <Tooltip content={customTooltip} />
                  <Legend wrapperStyle={{ paddingTop: "12px", fontSize: "12px" }} />
                  <Bar
                    dataKey="income"
                    name="Income"
                    fill="#269B72"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="expenses"
                    name="Expenses"
                    fill="#F07862"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-[#E8EDF4]">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Monthly Cash Flow Trajectory
            </CardTitle>
            <CardDescription className="text-xs">
              Savings trend over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={monthlyTrends}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#E8EDF4"
                  />
                  <XAxis
                    dataKey="month"
                    stroke="#8992A3"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis stroke="#8992A3" fontSize={11} tickLine={false} />
                  <Tooltip content={customTooltip} />
                  <Legend wrapperStyle={{ paddingTop: "12px", fontSize: "12px" }} />
                  <Line
                    type="monotone"
                    dataKey="savings"
                    name="Net Savings"
                    stroke="#2878E5"
                    strokeWidth={2.5}
                    dot={{ fill: "#2878E5", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="col-span-1 border border-[#E8EDF4] lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Category Expense Breakdown
            </CardTitle>
            <CardDescription className="text-xs">
              Detailed breakdown of expenses in selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            {categoryBreakdown.length === 0 ? (
              <p className="py-8 text-center text-xs text-[#8992A3]">
                No expenses logged in this selected date range.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E8EDF4] text-[#8992A3]">
                      <th className="pb-3 font-medium">Category</th>
                      <th className="pb-3 font-medium">Transactions</th>
                      <th className="pb-3 text-right font-medium">Amount</th>
                      <th className="pb-3 text-right font-medium">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8EDF4]">
                    {categoryBreakdown.map((category, index) => (
                      <tr
                        key={`${category.name}-${index}`}
                        className="hover:bg-[#F3F6FC]/50"
                      >
                        <td className="py-3 font-medium text-[#202735]">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: category.color }}
                            />
                            {category.name}
                          </div>
                        </td>
                        <td className="py-3 text-[#8992A3]">
                          {category.count} txns
                        </td>
                        <td className="py-3 text-right font-semibold text-[#202735]">
                          {formatCurrency(category.amount, currency)}
                        </td>
                        <td className="py-3 text-right font-medium text-[#2878E5]">
                          {category.percentage}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1 border border-[#E8EDF4]">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Distribution
            </CardTitle>
            <CardDescription className="text-xs">
              Visual category share
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-60 w-full">
              {categoryBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {categoryBreakdown.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color || "#2878E5"}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-[#8992A3]">
                  No data to display
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
