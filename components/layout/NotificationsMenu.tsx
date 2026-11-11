"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bell, CheckCircle2 } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { formatCurrency } from "@/lib/currency/currencies";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface BudgetRow {
  id: string;
  category: { name: string; color: string };
  spent: number;
  amount: number;
  currency: string;
  percentage: number;
  isExceeded: boolean;
}

/** Real alerts derived from this month's budgets (replaces the static placeholder). */
export function NotificationsMenu() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const { data } = useQuery({
    queryKey: ["budgets", { month, year }],
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) =>
      (await apiClient.get(`/budgets?month=${month}&year=${year}`, { signal })).data,
  });

  const alerts: BudgetRow[] = ((data?.budgets ?? []) as BudgetRow[])
    .filter((b) => b.percentage >= 80)
    .sort((a, b) => b.percentage - a.percentage);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative h-9 w-9"
          aria-label={alerts.length ? `Notifications, ${alerts.length} budget alerts` : "Notifications"}
        >
          <Bell className="h-4 w-4 text-muted-foreground" />
          {alerts.length > 0 && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-expense ring-2 ring-white" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-2">
        <p className="px-2 py-1.5 text-xs font-semibold text-main">Budget alerts</p>
        <DropdownMenuSeparator />
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-2 py-6 text-center text-xs text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 text-income" />
            All budgets are on track this month.
          </div>
        ) : (
          <ul className="max-h-72 space-y-1 overflow-y-auto py-1">
            {alerts.map((b) => (
              <li key={b.id} className="rounded-md px-2 py-2 hover:bg-muted">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-medium text-main">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: b.category.color }} />
                    {b.category.name}
                  </span>
                  <span className={b.isExceeded ? "font-semibold text-expense-text" : "font-semibold text-warning-foreground"}>
                    {b.percentage}%
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                  {formatCurrency(b.spent, b.currency)} of {formatCurrency(b.amount, b.currency)}
                  {b.isExceeded ? " — over budget" : " — nearing limit"}
                </p>
              </li>
            ))}
          </ul>
        )}
        <DropdownMenuSeparator />
        <Link href="/dashboard/budgets" className="block rounded-md px-2 py-1.5 text-center text-xs font-medium text-primary-text hover:bg-muted">
          View budgets
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
