"use client";

import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { isValidCurrency } from "@/lib/currency/currencies";
import { StatCard } from "@/components/shared/StatCard";
import { RecentTransactionsList } from "@/features/dashboard/RecentTransactionsList";
import { Wallet, TrendingUp, TrendingDown, PiggyBank, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const TransactionDialog = dynamic(
  () =>
    import("@/components/transactions/TransactionDialog").then(
      (module) => module.TransactionDialog
    ),
  { ssr: false }
);

const DashboardCharts = dynamic(
  () =>
    import("@/features/dashboard/DashboardCharts").then(
      (module) => module.DashboardCharts
    ),
  {
    loading: DashboardChartSkeleton,
  }
);

function DashboardChartSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-6 lg:grid-cols-3"
      aria-label="Loading financial charts"
      aria-busy="true"
    >
      <div className="h-80 animate-pulse rounded-xl border border-border bg-white lg:col-span-2" />
      <div className="h-80 animate-pulse rounded-xl border border-border bg-white" />
      <div className="h-64 animate-pulse rounded-xl border border-border bg-white lg:col-span-3" />
    </div>
  );
}

function DeferredDashboardCharts(
  props: React.ComponentProps<typeof DashboardCharts>
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!("IntersectionObserver" in window)) {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" }
    );
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef}>
      {shouldLoad ? <DashboardCharts {...props} /> : <DashboardChartSkeleton />}
    </div>
  );
}

export default function DashboardOverviewPage() {
  const queryClient = useQueryClient();
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);

  // 1. Fetch current user info
  const { data: userData } = useQuery({
    queryKey: ["currentUser"],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await apiClient.get("/auth/me");
      return res.data.user;
    },
  });

  // 2. Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await apiClient.get("/categories");
      return res.data.categories;
    },
  });

  // 3. Fetch reports / stats
  const {
    data: reportsData,
    isLoading: isReportsLoading,
    isError: isReportsError,
    refetch: refetchReports,
  } = useQuery({
    queryKey: ["reports"],
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const res = await apiClient.get("/reports?includeBalance=true", { signal });
      return res.data;
    },
  });

  // 4. Fetch recent transactions (limit 5 for overview)
  const {
    data: txData,
    isLoading: isTxLoading,
    isError: isTxError,
    refetch: refetchTx,
  } = useQuery({
    queryKey: ["recentTransactions"],
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const res = await apiClient.get("/transactions?limit=5&includeTotal=false&compact=true", {
        signal,
      });
      return res.data;
    },
  });

  const preferredCurrency = userData?.preferredCurrency || reportsData?.currency || "USD";
  const editingCurrency = isValidCurrency(userData?.preferredCurrency)
    ? userData.preferredCurrency
    : isValidCurrency(editingTransaction?.currency)
      ? editingTransaction.currency
      : null;
  const summary = reportsData?.summary || {
    totalIncome: 0,
    totalExpenses: 0,
    totalSavings: 0,
    incomeChange: 0,
    expensesChange: 0,
    savingsChange: 0,
  };

  // All-time net (income − expenses). Falls back to period net if the API omits it.
  const totalBalance: number = summary.totalBalance ?? summary.totalSavings;
  const recentTransactions = txData?.transactions || [];
  const categories = categoriesData || [];

  const handleRefresh = () => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ["reports"] }),
      queryClient.invalidateQueries({ queryKey: ["reportsDetail"] }),
      queryClient.invalidateQueries({ queryKey: ["recentTransactions"] }),
      queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      queryClient.invalidateQueries({ queryKey: ["budgets"] }),
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Refresh */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-main">Financial Overview</h2>
          <p className="text-xs text-muted-foreground">
            Track your cash flow, analyze spending patterns, and maintain monthly targets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {reportsData?.isEstimate && (
            <span className="rounded-full bg-warning-light px-2.5 py-1 text-[11px] font-medium text-warning-foreground">
              Fallback currency rates active
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="h-8 gap-1.5 border-border text-xs text-muted-foreground hover:text-main"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {isReportsError && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-lg border border-expense/30 bg-expense-light p-4 text-sm text-main sm:flex-row sm:items-center sm:justify-between"
        >
          <span>Up-to-date financial totals are unavailable. Please try again.</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetchReports()}
            className="w-fit border-expense/30"
          >
            Retry summary
          </Button>
        </div>
      )}

      {isTxError && (
        <div
          role="alert"
          className="rounded-lg border border-expense/30 bg-expense-light p-4 text-sm text-main"
        >
          Recent transactions are unavailable. Refresh to try again.
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetchTx()}
            className="ml-3 border-expense/30"
          >
            Retry
          </Button>
        </div>
      )}

      {isReportsLoading ? (
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          aria-label="Loading financial totals"
          aria-busy="true"
        >
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="h-32 animate-pulse rounded-xl border border-border bg-white"
            />
          ))}
        </div>
      ) : reportsData ? (
        <>
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Balance"
              amount={totalBalance}
              currency={preferredCurrency}
              icon={<Wallet className="h-5 w-5 text-primary-text" />}
              iconBgColor="bg-primary-light"
              type="default"
            />

            <StatCard
              title="Total Income"
              amount={summary.totalIncome}
              currency={preferredCurrency}
              changePercent={summary.incomeChange}
              icon={<TrendingUp className="h-5 w-5 text-income-text" />}
              iconBgColor="bg-income-light"
              type="income"
            />

            <StatCard
              title="Total Expenses"
              amount={summary.totalExpenses}
              currency={preferredCurrency}
              changePercent={summary.expensesChange}
              icon={<TrendingDown className="h-5 w-5 text-expense-text" />}
              iconBgColor="bg-expense-light"
              type="expense"
            />

            <StatCard
              title="Net Savings"
              amount={summary.totalSavings}
              currency={preferredCurrency}
              changePercent={summary.savingsChange}
              icon={<PiggyBank className="h-5 w-5 text-primary-text" />}
              iconBgColor="bg-primary-light"
              type="savings"
            />
          </div>

          {/* Interactive Charts Section */}
          <DeferredDashboardCharts
            monthlyTrends={reportsData.monthlyTrends || []}
            categoryBreakdown={reportsData.categoryBreakdown || []}
            currency={preferredCurrency}
          />
        </>
      ) : null}

      {/* Recent Transactions List */}
      {isTxLoading ? (
        <div
          className="h-64 animate-pulse rounded-xl border border-border bg-white"
          aria-label="Loading recent transactions"
          aria-busy="true"
        />
      ) : txData ? (
        <RecentTransactionsList
          transactions={recentTransactions}
          preferredCurrency={preferredCurrency}
          onEdit={(tx) => setEditingTransaction(tx)}
          onRefresh={handleRefresh}
        />
      ) : null}

      {/* Edit Transaction Dialog */}
      {editingTransaction && editingCurrency && (
        <TransactionDialog
          open={Boolean(editingTransaction)}
          onOpenChange={(open) => !open && setEditingTransaction(null)}
          categories={categories}
          defaultCurrency={editingCurrency}
          initialData={editingTransaction}
          onSuccess={handleRefresh}
        />
      )}
    </div>
  );
}
