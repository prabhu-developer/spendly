"use client";

import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency, SupportedCurrency } from "@/lib/currency/currencies";

interface MonthlyTrendItem {
  month: string;
  income: number;
  expenses: number;
  savings: number;
}

interface CategoryBreakdownItem {
  name: string;
  color: string;
  amount: number;
  percentage: number;
  count: number;
}

interface DashboardChartsProps {
  monthlyTrends: MonthlyTrendItem[];
  categoryBreakdown: CategoryBreakdownItem[];
  currency: SupportedCurrency | string;
}

export function DashboardCharts({
  monthlyTrends,
  categoryBreakdown,
  currency,
}: DashboardChartsProps) {
  const hasCategoryData = categoryBreakdown && categoryBreakdown.length > 0;
  const hasTrendData = monthlyTrends && monthlyTrends.length > 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-border bg-white p-3 shadow-lg">
          <p className="text-xs font-semibold text-main mb-1.5">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center gap-2 text-xs">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color || entry.stroke }}
              />
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="font-semibold text-main">
                {formatCurrency(entry.value, currency)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const CategoryTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border border-border bg-white p-3 shadow-lg">
          <p className="text-xs font-semibold text-main mb-1">{data.name}</p>
          <p className="text-xs text-muted-foreground">
            Amount: <span className="font-semibold text-main">{formatCurrency(data.amount, currency)}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Share: <span className="font-semibold text-primary-text">{data.percentage}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* 1. Income vs Expense Bar Chart */}
      <Card className="col-span-1 lg:col-span-2 border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Income vs Expense</CardTitle>
          <CardDescription className="text-xs">
            Comparison over the last 6 months
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="h-72 w-full">
            {hasTrendData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8EDF4" />
                  <XAxis dataKey="month" stroke="#8992A3" fontSize={11} tickLine={false} />
                  <YAxis stroke="#8992A3" fontSize={11} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ paddingTop: "12px", fontSize: "12px" }}
                    iconType="circle"
                  />
                  <Bar dataKey="income" name="Income" fill="#269B72" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#F07862" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No financial history available yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2. Expense Category Breakdown Donut Chart */}
      <Card className="col-span-1 border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Expense Breakdown</CardTitle>
          <CardDescription className="text-xs">
            Distribution by category
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="h-52 w-full">
            {hasCategoryData ? (
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
                        aria-label={`${entry.name}: ${Math.round(entry.percentage ?? 0)}% of spending`}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CategoryTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No expenses logged in this period
              </div>
            )}
          </div>

          {/* Top Categories legend */}
          {hasCategoryData && (
            <div className="mt-2 space-y-2 max-h-24 overflow-y-auto">
              {categoryBreakdown.slice(0, 4).map((cat, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="font-medium text-main">{cat.name}</span>
                  </div>
                  <span className="text-muted-foreground">{cat.percentage}%</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Monthly Spending Trend Area Chart */}
      <Card className="col-span-1 lg:col-span-3 border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Net Savings Trend</CardTitle>
          <CardDescription className="text-xs">
            Net cash flow surplus/deficit per month
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="h-56 w-full">
            {hasTrendData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2878E5" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#2878E5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8EDF4" />
                  <XAxis dataKey="month" stroke="#8992A3" fontSize={11} tickLine={false} />
                  <YAxis stroke="#8992A3" fontSize={11} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="savings"
                    name="Savings"
                    stroke="#2878E5"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#savingsGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No savings data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
