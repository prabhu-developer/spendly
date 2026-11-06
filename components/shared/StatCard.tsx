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
  iconBgColor = "bg-[#F3F6FC]",
  type = "default",
}: StatCardProps) {
  const isPositive = changePercent !== undefined && changePercent > 0;
  const isNegative = changePercent !== undefined && changePercent < 0;
  const isZero = changePercent !== undefined && changePercent === 0;

  return (
    <Card className="border border-[#E8EDF4] bg-white transition-all duration-200 hover:shadow-md">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#8992A3]">{title}</span>
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", iconBgColor)}>
            {icon}
          </div>
        </div>

        <div className="mt-4">
          <div
            className={cn(
              "text-2xl font-bold tracking-tight",
              type === "income" && "text-[#269B72]",
              type === "expense" && "text-[#F07862]",
              type === "default" && "text-[#202735]",
              type === "savings" && (amount >= 0 ? "text-[#2878E5]" : "text-[#F07862]")
            )}
          >
            {formatCurrency(amount, currency)}
          </div>

          {changePercent !== undefined && (
            <div className="mt-2 flex items-center text-xs">
              <span
                className={cn(
                  "inline-flex items-center font-medium",
                  isPositive && (type === "expense" ? "text-[#F07862]" : "text-[#269B72]"),
                  isNegative && (type === "expense" ? "text-[#269B72]" : "text-[#F07862]"),
                  isZero && "text-[#8992A3]"
                )}
              >
                {isPositive && <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" />}
                {isNegative && <ArrowDownRight className="mr-0.5 h-3.5 w-3.5" />}
                {isZero && <Minus className="mr-0.5 h-3.5 w-3.5" />}
                {Math.abs(changePercent)}%
              </span>
              <span className="ml-1.5 text-[#8992A3]">{changeLabel}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
