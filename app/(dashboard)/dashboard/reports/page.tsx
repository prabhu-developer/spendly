"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { formatCurrency } from "@/lib/currency/currencies";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/shared/StatCard";
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
  LineChart,
  Line,
} from "recharts";
import {
  Calendar,
  Printer,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Percent,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

export default function ReportsPage() {
  const now = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(now), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(now), "yyyy-MM-dd"));

  const { data: userData } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const res = await apiClient.get("/auth/me");
      return res.data.user;
    },
  });

  const { data: reportsData, isLoading, refetch } = useQuery({
    queryKey: ["reportsDetail", { startDate, endDate }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const res = await apiClient.get(`/reports?${params.toString()}`);
      return res.data;
    },
  });

  const preferredCurrency = userData?.preferredCurrency || reportsData?.currency || "USD";
  const summary = reportsData?.summary || {
    totalIncome: 0,
    totalExpenses: 0,
    totalSavings: 0,
    savingsRate: 0,
    incomeChange: 0,
    expensesChange: 0,
    savingsChange: 0,
  };

  const categoryBreakdown = reportsData?.categoryBreakdown || [];
  const monthlyTrends = reportsData?.monthlyTrends || [];

  const handlePrint = () => {
    window.print();
  };

  const setPresetRange = (preset: "thisMonth" | "lastMonth" | "last3Months") => {
    const today = new Date();
    if (preset === "thisMonth") {
      setStartDate(format(startOfMonth(today), "yyyy-MM-dd"));
      setEndDate(format(endOfMonth(today), "yyyy-MM-dd"));
    } else if (preset === "lastMonth") {
      const prev = subMonths(today, 1);
      setStartDate(format(startOfMonth(prev), "yyyy-MM-dd"));
      setEndDate(format(endOfMonth(prev), "yyyy-MM-dd"));
    } else if (preset === "last3Months") {
      const prev = subMonths(today, 2);
      setStartDate(format(startOfMonth(prev), "yyyy-MM-dd"));
      setEndDate(format(endOfMonth(today), "yyyy-MM-dd"));
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-[#E8EDF4] bg-white p-3 shadow-lg">
          <p className="text-xs font-semibold text-[#202735] mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center gap-2 text-xs">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color || entry.stroke }}
              />
              <span className="text-[#8992A3]">{entry.name}:</span>
              <span className="font-semibold text-[#202735]">
                {formatCurrency(entry.value, preferredCurrency)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Title & Date Range Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#202735]">Financial Reports</h2>
          <p className="text-xs text-[#8992A3]">
            Comprehensive cash flow breakdown, savings ratios, and historical spending trajectory.
          </p>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-9 gap-1.5 border-[#E8EDF4] text-xs text-[#202735]"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / Export PDF
          </Button>
        </div>
      </div>

      {/* Date Range Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E8EDF4] bg-white p-4 shadow-sm print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[#8992A3]">Period:</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPresetRange("thisMonth")}
            className="h-8 text-xs border-[#E8EDF4]"
          >
            This Month
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPresetRange("lastMonth")}
            className="h-8 text-xs border-[#E8EDF4]"
          >
            Last Month
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPresetRange("last3Months")}
            className="h-8 text-xs border-[#E8EDF4]"
          >
            Last 3 Months
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#8992A3]">From:</span>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 w-36 text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#8992A3]">To:</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 w-36 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Period Income"
          amount={summary.totalIncome}
          currency={preferredCurrency}
          changePercent={summary.incomeChange}
          icon={<TrendingUp className="h-5 w-5 text-[#269B72]" />}
          iconBgColor="bg-[#EAF6F1]"
          type="income"
        />

        <StatCard
          title="Period Expenses"
          amount={summary.totalExpenses}
          currency={preferredCurrency}
          changePercent={summary.expensesChange}
          icon={<TrendingDown className="h-5 w-5 text-[#F07862]" />}
          iconBgColor="bg-[#FDF1EE]"
          type="expense"
        />

        <StatCard
          title="Period Net Savings"
          amount={summary.totalSavings}
          currency={preferredCurrency}
          changePercent={summary.savingsChange}
          icon={<PiggyBank className="h-5 w-5 text-[#2878E5]" />}
          iconBgColor="bg-[#EBF3FC]"
          type="savings"
        />

        <Card className="border border-[#E8EDF4]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[#8992A3]">Savings Rate</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF6F1]">
                <Percent className="h-5 w-5 text-[#269B72]" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold tracking-tight text-[#202735]">
                {summary.savingsRate}%
              </div>
              <p className="mt-2 text-xs text-[#8992A3]">
                {summary.savingsRate >= 20 ? "Healthy savings ratio" : "Target 20%+ for long-term growth"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Income vs Expense Bar Chart */}
        <Card className="border border-[#E8EDF4]">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Income vs Expense Comparison</CardTitle>
            <CardDescription className="text-xs">Past 6 months overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8EDF4" />
                  <XAxis dataKey="month" stroke="#8992A3" fontSize={11} tickLine={false} />
                  <YAxis stroke="#8992A3" fontSize={11} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: "12px", fontSize: "12px" }} />
                  <Bar dataKey="income" name="Income" fill="#269B72" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#F07862" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Trend Line Chart */}
        <Card className="border border-[#E8EDF4]">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Monthly Cash Flow Trajectory</CardTitle>
            <CardDescription className="text-xs">Savings trend over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8EDF4" />
                  <XAxis dataKey="month" stroke="#8992A3" fontSize={11} tickLine={false} />
                  <YAxis stroke="#8992A3" fontSize={11} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
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

      {/* Category Breakdown Table & Pie */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="col-span-1 lg:col-span-2 border border-[#E8EDF4]">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Category Expense Breakdown</CardTitle>
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
                    {categoryBreakdown.map((cat: any, idx: number) => (
                      <tr key={idx} className="hover:bg-[#F3F6FC]/50">
                        <td className="py-3 font-medium text-[#202735]">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: cat.color }}
                            />
                            {cat.name}
                          </div>
                        </td>
                        <td className="py-3 text-[#8992A3]">{cat.count} txns</td>
                        <td className="py-3 text-right font-semibold text-[#202735]">
                          {formatCurrency(cat.amount, preferredCurrency)}
                        </td>
                        <td className="py-3 text-right text-[#2878E5] font-medium">
                          {cat.percentage}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Visual Pie */}
        <Card className="col-span-1 border border-[#E8EDF4]">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Distribution</CardTitle>
            <CardDescription className="text-xs">Visual category share</CardDescription>
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
                      {categoryBreakdown.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color || "#2878E5"} />
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
    </div>
  );
}
