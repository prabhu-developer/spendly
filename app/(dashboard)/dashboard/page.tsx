"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getDaysInMonth } from "date-fns";
import { LayoutGrid, Percent, RefreshCw, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import {
  invalidateFinancialData,
  useAccounts,
  useCategories,
  useCurrentUser,
} from "@/lib/api/queries";
import { formatCurrency, isValidCurrency } from "@/lib/currency/currencies";
import { buildInsights } from "@/lib/dashboard/insights";
import { useLocalPreference } from "@/lib/hooks/useLocalPreference";
import { StatCard } from "@/components/shared/StatCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RecentTransactionsList } from "@/features/dashboard/RecentTransactionsList";
import {
  AccountsOverviewCard,
  BudgetProgressCard,
  InsightsCard,
  OnboardingChecklist,
  type BudgetProgressRow,
} from "@/features/dashboard/DashboardWidgets";
import { OfflineDraftsPanel } from "@/components/offline/OfflineDraftsPanel";

const TransactionDialog = dynamic(
  () => import("@/components/transactions/TransactionDialog").then((m) => m.TransactionDialog),
  { ssr: false }
);

const DashboardCharts = dynamic(
  () => import("@/features/dashboard/DashboardCharts").then((m) => m.DashboardCharts),
  { loading: DashboardChartSkeleton }
);

function DashboardChartSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3" aria-label="Loading financial charts" aria-busy="true">
      <Skeleton className="h-80 rounded-xl lg:col-span-2" />
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

/** Load the (heavy) chart bundle only when the charts scroll into view. */
function DeferredDashboardCharts(props: React.ComponentProps<typeof DashboardCharts>) {
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

  return <div ref={containerRef}>{shouldLoad ? <DashboardCharts {...props} /> : <DashboardChartSkeleton />}</div>;
}

const WIDGETS = [
  { id: "kpis", label: "Key figures" },
  { id: "charts", label: "Cash flow & spending" },
  { id: "budgets", label: "Budget progress" },
  { id: "accounts", label: "Accounts" },
  { id: "insights", label: "Insights" },
  { id: "recent", label: "Recent transactions" },
] as const;
type WidgetId = (typeof WIDGETS)[number]["id"];

export default function DashboardOverviewPage() {
  const queryClient = useQueryClient();
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);

  const { data: userData } = useCurrentUser();
  const { data: categoriesData } = useCategories();
  const userId: string | undefined = userData?.id ?? userData?.userId;

  const {
    data: reportsData,
    isLoading: isReportsLoading,
    isError: isReportsError,
    refetch: refetchReports,
  } = useQuery({
    queryKey: ["reports", "dashboard"],
    queryFn: async ({ signal }) => (await apiClient.get("/reports?includeBalance=true", { signal })).data,
  });

  const {
    data: txData,
    isLoading: isTxLoading,
    isError: isTxError,
    refetch: refetchTx,
  } = useQuery({
    queryKey: ["recentTransactions"],
    queryFn: async ({ signal }) =>
      (await apiClient.get("/transactions?limit=5&includeTotal=false&compact=true", { signal })).data,
  });

  const { data: sheet, isLoading: isAccountsLoading } = useAccounts();

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  // Same key as the header notifications → one shared request
  const { data: budgetsData, isLoading: isBudgetsLoading } = useQuery({
    queryKey: ["budgets", { month, year }],
    staleTime: 60_000,
    queryFn: async ({ signal }) =>
      (await apiClient.get(`/budgets?month=${month}&year=${year}`, { signal })).data,
  });

  // Widget visibility (per user, per device)
  const [hidden, setHidden] = useLocalPreference<Partial<Record<WidgetId, boolean>>>(
    userId ? `spendly:dashboard:${userId}:hidden` : null,
    {}
  );
  const [onboardingDismissed, setOnboardingDismissed] = useLocalPreference<boolean>(
    userId ? `spendly:dashboard:${userId}:onboarding-dismissed` : null,
    false
  );
  const show = (id: WidgetId) => !hidden[id];

  const preferredCurrency = isValidCurrency(userData?.preferredCurrency)
    ? userData.preferredCurrency
    : reportsData?.currency || "USD";
  const editingCurrency = isValidCurrency(userData?.preferredCurrency)
    ? userData.preferredCurrency
    : isValidCurrency(editingTransaction?.currency)
      ? editingTransaction.currency
      : null;
  const summary = reportsData?.summary ?? {
    totalIncome: 0,
    totalExpenses: 0,
    totalSavings: 0,
    savingsRate: 0,
    incomeChange: 0,
    expensesChange: 0,
    savingsChange: 0,
  };
  const budgets: BudgetProgressRow[] = budgetsData?.budgets ?? [];
  const recentTransactions = txData?.transactions ?? [];
  const accounts = sheet?.accounts ?? [];
  // Net worth from the balance sheet; falls back to all-time net if accounts are unavailable
  const netWorth: number = sheet?.netWorth ?? summary.totalBalance ?? summary.totalSavings;

  const insights = useMemo(() => {
    if (!reportsData) return [];
    const top = reportsData.categoryBreakdown?.[0];
    return buildInsights({
      totalIncome: summary.totalIncome,
      totalExpenses: summary.totalExpenses,
      savingsRate: summary.savingsRate,
      expensesChange: summary.expensesChange,
      incomeChange: summary.incomeChange,
      topCategory: top ? { name: top.name, percentage: top.percentage } : null,
      budgets: budgetsData
        ? {
            exceeded: budgets.filter((b) => b.isExceeded).length,
            nearing: budgets.filter((b) => !b.isExceeded && b.percentage >= 80).length,
            total: budgets.length,
          }
        : undefined,
      dayOfMonth: now.getDate(),
      daysInMonth: getDaysInMonth(now),
      formatMoney: (n) => formatCurrency(n, preferredCurrency),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportsData, budgetsData, preferredCurrency]);

  const onboardingSteps = [
    {
      id: "account",
      label: "Add an account",
      description: "Bank, card or cash — for real balances.",
      href: "/dashboard/accounts?new=1",
      done: accounts.length > 0,
    },
    {
      id: "transaction",
      label: "Record a transaction",
      description: "Track an income or expense.",
      href: "/dashboard/transactions/new",
      done: recentTransactions.length > 0,
    },
    {
      id: "budget",
      label: "Set a monthly budget",
      description: "Get alerts before you overspend.",
      href: "/dashboard/budgets",
      done: budgets.length > 0,
    },
  ];
  const onboardingReady = Boolean(sheet && txData && budgetsData);
  const showOnboarding = onboardingReady && !onboardingDismissed && onboardingSteps.some((s) => !s.done);

  const handleRefresh = () => void invalidateFinancialData(queryClient);
  const sideWidgets = (["budgets", "accounts", "insights"] as const).filter(show);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        actions={
          <>
            {reportsData?.isEstimate && (
              <span className="rounded-full bg-warning-light px-2.5 py-1 text-[11px] font-medium text-warning-foreground">
                Estimated exchange rates
              </span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Customize
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-xs">Show on dashboard</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {WIDGETS.map((w) => (
                  <DropdownMenuCheckboxItem
                    key={w.id}
                    checked={show(w.id)}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={(checked) => setHidden((h) => ({ ...h, [w.id]: !checked }))}
                  >
                    {w.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="h-8 text-xs">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </>
        }
      />

      {userId && <OfflineDraftsPanel userId={userId} />}

      {showOnboarding && (
        <OnboardingChecklist steps={onboardingSteps} onDismiss={() => setOnboardingDismissed(true)} />
      )}

      {isReportsError && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-xl border border-expense/30 bg-expense-light p-4 text-sm text-main sm:flex-row sm:items-center sm:justify-between"
        >
          <span>Up-to-date financial totals are unavailable. Please try again.</span>
          <Button variant="outline" size="sm" onClick={() => void refetchReports()} className="w-fit">
            Retry
          </Button>
        </div>
      )}

      {show("kpis") &&
        (isReportsLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Loading financial totals" aria-busy="true">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        ) : reportsData ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Net worth"
              amount={netWorth}
              currency={preferredCurrency}
              icon={<Scale className="h-5 w-5 text-primary" />}
              iconBgColor="bg-primary-light"
              type="savings"
              footnote={
                sheet && accounts.length > 0
                  ? `Assets ${formatCurrency(sheet.assets, preferredCurrency)} · Debt ${formatCurrency(sheet.liabilities, preferredCurrency)}`
                  : "All-time income minus expenses"
              }
            />
            <StatCard
              title="Income this month"
              amount={summary.totalIncome}
              currency={preferredCurrency}
              changePercent={summary.incomeChange}
              icon={<TrendingUp className="h-5 w-5 text-income" />}
              iconBgColor="bg-income-light"
              type="income"
            />
            <StatCard
              title="Expenses this month"
              amount={summary.totalExpenses}
              currency={preferredCurrency}
              changePercent={summary.expensesChange}
              icon={<TrendingDown className="h-5 w-5 text-expense" />}
              iconBgColor="bg-expense-light"
              type="expense"
            />
            <StatCard
              title="Savings rate"
              amount={summary.totalSavings}
              currency={preferredCurrency}
              valueOverride={summary.totalIncome > 0 ? `${summary.savingsRate}%` : "—"}
              icon={<Percent className="h-5 w-5 text-primary" />}
              iconBgColor="bg-primary-light"
              type="default"
              footnote={`Net ${summary.totalSavings >= 0 ? "saved" : "overspent"}: ${formatCurrency(Math.abs(summary.totalSavings), preferredCurrency)}`}
            />
          </div>
        ) : null)}

      {show("charts") && reportsData && (
        <DeferredDashboardCharts
          monthlyTrends={reportsData.monthlyTrends || []}
          categoryBreakdown={reportsData.categoryBreakdown || []}
          currency={preferredCurrency}
        />
      )}

      {sideWidgets.length > 0 && (
        <div
          className={
            sideWidgets.length === 1
              ? "grid grid-cols-1"
              : sideWidgets.length === 2
                ? "grid grid-cols-1 gap-6 md:grid-cols-2"
                : "grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3"
          }
        >
          {show("budgets") && <BudgetProgressCard budgets={budgets} isLoading={isBudgetsLoading} />}
          {show("accounts") && (
            <AccountsOverviewCard accounts={accounts} currency={preferredCurrency} isLoading={isAccountsLoading} />
          )}
          {show("insights") && <InsightsCard insights={insights} isLoading={isReportsLoading} />}
        </div>
      )}

      {show("recent") && (
        <>
          {isTxError && (
            <div role="alert" className="flex items-center justify-between rounded-xl border border-expense/30 bg-expense-light p-4 text-sm text-main">
              Recent transactions are unavailable.
              <Button variant="outline" size="sm" onClick={() => void refetchTx()}>
                Retry
              </Button>
            </div>
          )}
          {isTxLoading ? (
            <Skeleton className="h-64 rounded-xl" aria-label="Loading recent transactions" />
          ) : txData ? (
            <RecentTransactionsList
              transactions={recentTransactions}
              preferredCurrency={preferredCurrency}
              onEdit={(tx) => setEditingTransaction(tx)}
              onRefresh={handleRefresh}
            />
          ) : null}
        </>
      )}

      {editingTransaction && editingCurrency && (
        <TransactionDialog
          open={Boolean(editingTransaction)}
          onOpenChange={(open) => !open && setEditingTransaction(null)}
          categories={categoriesData ?? []}
          defaultCurrency={editingCurrency}
          initialData={editingTransaction}
          onSuccess={handleRefresh}
        />
      )}
    </div>
  );
}
