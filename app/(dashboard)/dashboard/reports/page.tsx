"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/shared/StatCard";
import {
  Calendar,
  Printer,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Percent,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

const ReportCharts = dynamic(
  () =>
    import("@/features/dashboard/ReportCharts").then(
      (module) => module.ReportCharts
    ),
  {
    loading: () => (
      <div
        className="space-y-6"
        aria-label="Loading report charts"
        aria-busy="true"
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-96 animate-pulse rounded-xl border border-[#E8EDF4] bg-white" />
          <div className="h-96 animate-pulse rounded-xl border border-[#E8EDF4] bg-white" />
        </div>
        <div className="h-80 animate-pulse rounded-xl border border-[#E8EDF4] bg-white" />
      </div>
    ),
  }
);

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
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const res = await apiClient.get(`/reports?${params.toString()}`, { signal });
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

      <ReportCharts
        monthlyTrends={monthlyTrends}
        categoryBreakdown={categoryBreakdown}
        currency={preferredCurrency}
      />
    </div>
  );
}
