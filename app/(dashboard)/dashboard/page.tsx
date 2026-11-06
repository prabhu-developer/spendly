"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { StatCard } from "@/components/shared/StatCard";
import { DashboardCharts } from "@/features/dashboard/DashboardCharts";
import { RecentTransactionsList } from "@/features/dashboard/RecentTransactionsList";
import { TransactionDialog } from "@/components/transactions/TransactionDialog";
import { Wallet, TrendingUp, TrendingDown, PiggyBank, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardOverviewPage() {
  const queryClient = useQueryClient();
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);

  // 1. Fetch current user info
  const { data: userData } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const res = await apiClient.get("/auth/me");
      return res.data.user;
    },
  });

  // 2. Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await apiClient.get("/categories");
      return res.data.categories;
    },
  });

  // 3. Fetch reports / stats
  const {
    data: reportsData,
    isLoading: isReportsLoading,
    refetch: refetchReports,
  } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const res = await apiClient.get("/reports");
      return res.data;
    },
  });

  // 4. Fetch recent transactions (limit 5 for overview)
  const {
    data: txData,
    isLoading: isTxLoading,
    refetch: refetchTx,
  } = useQuery({
    queryKey: ["recentTransactions"],
    queryFn: async () => {
      const res = await apiClient.get("/transactions?limit=5");
      return res.data;
    },
  });

  const preferredCurrency = userData?.preferredCurrency || reportsData?.currency || "USD";
  const summary = reportsData?.summary || {
    totalIncome: 0,
    totalExpenses: 0,
    totalSavings: 0,
    incomeChange: 0,
    expensesChange: 0,
    savingsChange: 0,
  };

  const totalBalance = summary.totalSavings;
  const recentTransactions = txData?.transactions || [];
  const categories = categoriesData || [];

  const handleRefresh = () => {
    queryClient.invalidateQueries();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Refresh */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#202735]">Financial Overview</h2>
          <p className="text-xs text-[#8992A3]">
            Track your cash flow, analyze spending patterns, and maintain monthly targets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {reportsData?.isEstimate && (
            <span className="rounded-full bg-[#FEF8EC] px-2.5 py-1 text-[11px] font-medium text-[#E9B949]">
              Fallback currency rates active
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="h-8 gap-1.5 border-[#E8EDF4] text-xs text-[#8992A3] hover:text-[#202735]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Balance"
          amount={totalBalance}
          currency={preferredCurrency}
          changePercent={summary.savingsChange}
          icon={<Wallet className="h-5 w-5 text-[#2878E5]" />}
          iconBgColor="bg-[#EBF3FC]"
          type="default"
        />

        <StatCard
          title="Total Income"
          amount={summary.totalIncome}
          currency={preferredCurrency}
          changePercent={summary.incomeChange}
          icon={<TrendingUp className="h-5 w-5 text-[#269B72]" />}
          iconBgColor="bg-[#EAF6F1]"
          type="income"
        />

        <StatCard
          title="Total Expenses"
          amount={summary.totalExpenses}
          currency={preferredCurrency}
          changePercent={summary.expensesChange}
          icon={<TrendingDown className="h-5 w-5 text-[#F07862]" />}
          iconBgColor="bg-[#FDF1EE]"
          type="expense"
        />

        <StatCard
          title="Net Savings"
          amount={summary.totalSavings}
          currency={preferredCurrency}
          changePercent={summary.savingsChange}
          icon={<PiggyBank className="h-5 w-5 text-[#2878E5]" />}
          iconBgColor="bg-[#EBF3FC]"
          type="savings"
        />
      </div>

      {/* Interactive Charts Section */}
      <DashboardCharts
        monthlyTrends={reportsData?.monthlyTrends || []}
        categoryBreakdown={reportsData?.categoryBreakdown || []}
        currency={preferredCurrency}
      />

      {/* Recent Transactions List */}
      <RecentTransactionsList
        transactions={recentTransactions}
        preferredCurrency={preferredCurrency}
        onEdit={(tx) => setEditingTransaction(tx)}
        onRefresh={handleRefresh}
      />

      {/* Edit Transaction Dialog */}
      {editingTransaction && (
        <TransactionDialog
          open={Boolean(editingTransaction)}
          onOpenChange={(open) => !open && setEditingTransaction(null)}
          categories={categories}
          defaultCurrency={preferredCurrency}
          initialData={editingTransaction}
          onSuccess={handleRefresh}
        />
      )}
    </div>
  );
}
