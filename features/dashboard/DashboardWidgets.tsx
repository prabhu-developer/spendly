"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Landmark,
  Lightbulb,
  PieChart,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/currency/currencies";
import type { AccountSummary } from "@/lib/api/queries";
import type { Insight } from "@/lib/dashboard/insights";
import { cn } from "@/lib/utils";

function WidgetHeader({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <CardHeader className="flex-row items-center justify-between space-y-0 p-5 pb-3">
      <CardTitle className="text-sm">{title}</CardTitle>
      {href && (
        <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-primary-text hover:underline">
          {linkLabel ?? "View all"}
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </CardHeader>
  );
}

export interface BudgetProgressRow {
  id: string;
  category: { name: string; color: string };
  spent: number;
  amount: number;
  currency: string;
  percentage: number;
  isExceeded: boolean;
}

export function BudgetProgressCard({
  budgets,
  isLoading,
}: {
  budgets: BudgetProgressRow[];
  isLoading: boolean;
}) {
  const sorted = [...budgets].sort((a, b) => b.percentage - a.percentage).slice(0, 5);
  return (
    <Card className="flex h-full flex-col">
      <WidgetHeader title="Budget progress" href="/dashboard/budgets" />
      <CardContent className="flex-1 space-y-4 p-5 pt-0">
        {isLoading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-9" />)
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <PieChart className="h-6 w-6 text-muted-subtle" />
            <p className="text-xs text-muted-foreground">No budgets set for this month.</p>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/budgets">Set a budget</Link>
            </Button>
          </div>
        ) : (
          sorted.map((b) => {
            const pct = Math.min(100, b.percentage);
            const tone = b.isExceeded ? "bg-expense" : b.percentage >= 80 ? "bg-warning" : "bg-income";
            return (
              <div key={b.id}>
                <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-2 font-medium text-main">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: b.category.color }} />
                    <span className="truncate">{b.category.name}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatCurrency(b.spent, b.currency)} / {formatCurrency(b.amount, b.currency)}
                  </span>
                </div>
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-label={`${b.category.name} budget used`}
                  aria-valuenow={b.percentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className={cn("h-full rounded-full transition-[width] duration-500", tone)} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

export function AccountsOverviewCard({
  accounts,
  currency,
  isLoading,
}: {
  accounts: AccountSummary[];
  currency: string;
  isLoading: boolean;
}) {
  const active = accounts.filter((a) => !a.isArchived).slice(0, 5);
  return (
    <Card className="flex h-full flex-col">
      <WidgetHeader title="Accounts" href="/dashboard/accounts" />
      <CardContent className="flex-1 p-5 pt-0">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : active.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Landmark className="h-6 w-6 text-muted-subtle" />
            <p className="text-xs text-muted-foreground">Add accounts to track balances and net worth.</p>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/accounts?new=1">Add account</Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {active.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/dashboard/transactions?accountId=${a.id}`}
                  className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5 hover:bg-muted"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="h-7 w-7 shrink-0 rounded-lg" style={{ backgroundColor: a.color }} aria-hidden="true" />
                    <span className="truncate text-sm font-medium text-main">{a.name}</span>
                  </span>
                  <span className="text-right">
                    <span className={cn("block text-sm font-semibold tabular-nums", a.balance < 0 ? "text-expense-text" : "text-main")}>
                      {formatCurrency(a.balance, a.currency)}
                    </span>
                    {a.currency !== currency && (
                      <span className="block text-[11px] tabular-nums text-muted-foreground">
                        ≈ {formatCurrency(a.convertedBalance, currency)}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const TONE_STYLES = {
  positive: { icon: TrendingUp, className: "bg-income-light text-income-text" },
  warning: { icon: AlertTriangle, className: "bg-warning-light text-warning-foreground" },
  neutral: { icon: Lightbulb, className: "bg-primary-light text-primary-text" },
} as const;

export function InsightsCard({ insights, isLoading }: { insights: Insight[]; isLoading: boolean }) {
  return (
    <Card className="flex h-full flex-col">
      <WidgetHeader title="Insights" href="/dashboard/reports" linkLabel="Reports" />
      <CardContent className="flex-1 space-y-3 p-5 pt-0">
        {isLoading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)
        ) : insights.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Sparkles className="h-6 w-6 text-muted-subtle" />
            <p className="text-xs text-muted-foreground">Insights appear once you have some activity this month.</p>
          </div>
        ) : (
          insights.map((insight) => {
            const tone = TONE_STYLES[insight.tone];
            const Icon = tone.icon;
            return (
              <div key={insight.id} className="flex gap-3">
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", tone.className)}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-main">{insight.title}</p>
                  <p className="text-xs text-muted-foreground">{insight.detail}</p>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

export function OnboardingChecklist({
  steps,
  onDismiss,
}: {
  steps: { id: string; label: string; description: string; href: string; done: boolean }[];
  onDismiss: () => void;
}) {
  const done = steps.filter((s) => s.done).length;
  return (
    <Card className="relative overflow-hidden border-primary/20">
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss getting started"
        className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted"
      >
        <X className="h-4 w-4" />
      </button>
      <CardContent className="p-5">
        <div className="mb-4 pr-8">
          <p className="text-sm font-semibold text-main">Get started with Spendly</p>
          <p className="text-xs text-muted-foreground">
            {done} of {steps.length} done — a few steps to get accurate balances and insights.
          </p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(done / steps.length) * 100}%` }} />
          </div>
        </div>
        <ol className="grid gap-2 sm:grid-cols-3">
          {steps.map((step) => (
            <li key={step.id}>
              <Link
                href={step.href}
                className={cn(
                  "flex h-full gap-3 rounded-lg border p-3 transition-colors",
                  step.done ? "border-border bg-muted/60" : "border-border hover:border-primary/40 hover:bg-primary-light/40"
                )}
              >
                {step.done ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-income" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-subtle" />
                )}
                <span>
                  <span className={cn("block text-sm font-medium", step.done ? "text-muted-foreground line-through" : "text-main")}>
                    {step.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">{step.description}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
