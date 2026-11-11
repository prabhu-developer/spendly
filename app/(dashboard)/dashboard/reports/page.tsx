"use client";

import React, { Suspense, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { format, isValid, parseISO } from "date-fns";
import { AlertTriangle, Download, Percent, PiggyBank, Printer, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { downloadCsv } from "@/lib/reports/csv";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/shared/StatCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { ReportRangeBar, presetRange } from "@/features/reports/ReportRangeBar";
import { buildReportCsv } from "@/features/reports/exportReport";
import type { InsightsResponse, ReportsResponse } from "@/features/reports/types";
import { cn } from "@/lib/utils";

function ChartsSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading report charts" aria-busy="true">
      <Skeleton className="h-80 rounded-xl border border-border bg-white" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl border border-border bg-white lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl border border-border bg-white" />
      </div>
    </div>
  );
}

const ReportCharts = dynamic(
  () => import("@/features/dashboard/ReportCharts").then((m) => m.ReportCharts),
  { loading: ChartsSkeleton }
);

const InsightsSections = dynamic(
  () => import("@/features/reports/InsightsSections").then((m) => m.InsightsSections),
  { loading: ChartsSkeleton }
);

const isDateParam = (value: string | null): value is string =>
  Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value)));

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-xl border border-expense/30 bg-expense-light px-4 py-3 text-sm text-main sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-expense-text" aria-hidden />
        {message}
      </span>
      <Button variant="outline" size="sm" onClick={onRetry} className="w-fit">
        <RefreshCw className="h-3.5 w-3.5" />
        Try again
      </Button>
    </div>
  );
}

function ReportsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Range lives in the URL (?from=&to=) so reports are shareable and survive reloads.
  const defaults = useMemo(() => presetRange("thisMonth"), []);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const from = isDateParam(fromParam) ? fromParam : defaults.from;
  const to = isDateParam(toParam) ? toParam : defaults.to;
  const rangeValid = from <= to;

  const setRange = useCallback(
    (range: { from: string; to: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("from", range.from);
      params.set("to", range.to);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const rangeParams = `startDate=${from}&endDate=${to}`;

  const reportQuery = useQuery({
    queryKey: ["reportsDetail", { startDate: from, endDate: to }],
    enabled: rangeValid,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const res = await apiClient.get<ReportsResponse>(`/reports?${rangeParams}`, { signal });
      return res.data;
    },
  });

  const insightsQuery = useQuery({
    queryKey: ["reportsInsights", { startDate: from, endDate: to }],
    enabled: rangeValid,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const res = await apiClient.get<InsightsResponse>(`/reports/insights?${rangeParams}`, { signal });
      return res.data;
    },
  });

  const report = reportQuery.data;
  const insights = insightsQuery.data;
  const currency = report?.currency || insights?.currency || "USD";
  const summary = report?.summary;
  const isRefreshing = (reportQuery.isFetching && !reportQuery.isLoading) || (insightsQuery.isFetching && !insightsQuery.isLoading);

  const periodLabel = `${format(parseISO(from), "dd MMM yyyy")} – ${format(parseISO(to), "dd MMM yyyy")}`;

  const handleExportCsv = () => {
    if (!report) return;
    downloadCsv(`spendly-report_${from}_${to}.csv`, buildReportCsv(report, insights, { from, to }));
  };

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Print layout for "Download PDF": hide app chrome, keep brand colours */}
      <style>{`
        @media print {
          @page { margin: 14mm; }
          body { background: #fff !important; padding: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body aside, body header, body footer, body nav, [role="status"] { display: none !important; }
          main { padding: 0 !important; }
          .shadow-card { box-shadow: none !important; }
        }
      `}</style>
      {/* Print-only header */}
      <div className="hidden print:block">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Spendly</p>
        <h1 className="text-2xl font-semibold text-main">Financial report</h1>
        <p className="text-sm text-main">{periodLabel}</p>
        <p className="text-xs text-muted-foreground">
          Generated {format(new Date(), "dd MMM yyyy, HH:mm")} · Amounts in {currency}
          {(report?.isEstimate || insights?.isEstimate) && " · Converted using estimated exchange rates"}
        </p>
      </div>

      <div className="print:hidden">
        <PageHeader
          title="Reports"
          actions={
            <>
              <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={!report}>
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!report}>
                <Printer className="h-3.5 w-3.5" />
                Download PDF
              </Button>
            </>
          }
        />
      </div>

      <ReportRangeBar from={from} to={to} onChange={setRange} />

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground print:hidden" aria-live="polite">
        <span>
          Showing <span className="font-medium text-main">{periodLabel}</span>
          {report?.previousPeriod && (
            <>
              {" "}· compared with {format(parseISO(report.previousPeriod.startDate), "dd MMM")} –{" "}
              {format(parseISO(report.previousPeriod.endDate), "dd MMM yyyy")}
            </>
          )}
        </span>
        {isRefreshing && <span className="text-primary-text">Updating…</span>}
        {(report?.isEstimate || insights?.isEstimate) && (
          <span className="rounded-full bg-warning-light px-2 py-0.5 font-medium text-warning-foreground">
            Estimated exchange rates
          </span>
        )}
      </div>

      {!rangeValid && (
        <p role="alert" className="rounded-lg bg-expense-light px-3 py-2 text-xs text-expense-text">
          The start date must be on or before the end date.
        </p>
      )}

      {/* KPIs */}
      {reportQuery.isError && !report ? (
        <ErrorPanel message={getErrorMessage(reportQuery.error, "The report could not be loaded.")} onRetry={() => void reportQuery.refetch()} />
      ) : !summary ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Loading totals" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl border border-border bg-white" />
          ))}
        </div>
      ) : (
        <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4", isRefreshing && "opacity-70 transition-opacity")}>
          <StatCard
            title="Income"
            amount={summary.totalIncome}
            currency={currency}
            changePercent={summary.incomeChange}
            changeLabel="vs previous period"
            icon={<TrendingUp className="h-5 w-5 text-income" />}
            iconBgColor="bg-income-light"
            type="income"
          />
          <StatCard
            title="Expenses"
            amount={summary.totalExpenses}
            currency={currency}
            changePercent={summary.expensesChange}
            changeLabel="vs previous period"
            icon={<TrendingDown className="h-5 w-5 text-expense" />}
            iconBgColor="bg-expense-light"
            type="expense"
          />
          <StatCard
            title="Net savings"
            amount={summary.totalSavings}
            currency={currency}
            changePercent={summary.savingsChange}
            changeLabel="vs previous period"
            icon={<PiggyBank className="h-5 w-5 text-primary" />}
            iconBgColor="bg-primary-light"
            type="savings"
          />
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Savings rate</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-income-light">
                  <Percent className="h-5 w-5 text-income" />
                </div>
              </div>
              <div className="mt-4">
                <div
                  className={cn(
                    "text-2xl font-bold tracking-tight tabular-nums",
                    summary.savingsRate < 0 ? "text-expense-text" : "text-main"
                  )}
                >
                  {summary.savingsRate}%
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {report?.previousSummary ? (
                    <>
                      Previous period{" "}
                      <span className="font-medium tabular-nums text-main">{report.previousSummary.savingsRate}%</span>
                      {" · "}
                    </>
                  ) : null}
                  {summary.totalIncome === 0
                    ? "No income recorded"
                    : summary.savingsRate >= 20
                      ? "Healthy (20%+)"
                      : "Target 20%+"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {report && (
        <ReportCharts
          cashFlow={report.cashFlow ?? []}
          categoryBreakdown={report.categoryBreakdown ?? []}
          categoryComparison={report.categoryComparison ?? []}
          currency={currency}
          range={{ from, to }}
        />
      )}

      {insightsQuery.isError && !insights ? (
        <ErrorPanel
          message={getErrorMessage(insightsQuery.error, "Budget, merchant and net worth insights could not be loaded.")}
          onRetry={() => void insightsQuery.refetch()}
        />
      ) : insights ? (
        <InsightsSections insights={insights} range={{ from, to }} />
      ) : rangeValid ? (
        <ChartsSkeleton />
      ) : null}
    </div>
  );
}

export default function ReportsPage() {
  // useSearchParams requires a Suspense boundary in the App Router
  return (
    <Suspense fallback={<ChartsSkeleton />}>
      <ReportsContent />
    </Suspense>
  );
}
