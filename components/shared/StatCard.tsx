import React, { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, SupportedCurrency } from "@/lib/currency/currencies";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  amount: number;
  currency: SupportedCurrency | string;
  changePercent?: number;
  changeLabel?: string;
  icon: ReactNode;
  iconBgColor?: string;
  type?: "default" | "income" | "expense" | "savings";
}

export function StatCard({
  title,
  amount,
  currency,
  changePercent,
  changeLabel = "vs last month",
  icon,
  iconBgColor = "bg-muted",
  type = "default",
}: StatCardProps) {
  const isPositive = changePercent !== undefined && changePercent > 0;
  const isNegative = changePercent !== undefined && changePercent < 0;
  const isZero = changePercent !== undefined && changePercent === 0;

  return (
    <Card className="border border-border bg-white transition-all duration-200 hover:shadow-md">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", iconBgColor)}>
            {icon}
          </div>
        </div>

        <div className="mt-4">
          <div
            className={cn(
              "text-2xl font-bold tracking-tight",
              type === "income" && "text-income-text",
              type === "expense" && "text-expense-text",
              type === "default" && "text-main",
              type === "savings" && (amount >= 0 ? "text-primary-text" : "text-expense-text")
            )}
          >
            {formatCurrency(amount, currency)}
          </div>

          {changePercent !== undefined && (
            <div className="mt-2 flex items-center text-xs">
              <span
                className={cn(
                  "inline-flex items-center font-medium",
                  isPositive && (type === "expense" ? "text-expense-text" : "text-income-text"),
                  isNegative && (type === "expense" ? "text-income-text" : "text-expense-text"),
                  isZero && "text-muted-foreground"
                )}
              >
                {isPositive && <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" />}
                {isNegative && <ArrowDownRight className="mr-0.5 h-3.5 w-3.5" />}
                {isZero && <Minus className="mr-0.5 h-3.5 w-3.5" />}
                {Math.abs(changePercent)}%
              </span>
              <span className="ml-1.5 text-muted-foreground">{changeLabel}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
