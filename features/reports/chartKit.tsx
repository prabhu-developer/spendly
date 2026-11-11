"use client";

import { formatCurrency } from "@/lib/currency/currencies";

/** Chart palette drawn from the Spendly light theme tokens. */
export const CHART_COLORS = {
  income: "#269B72",
  expense: "#F07862",
  primary: "#2878E5",
  grid: "#E8EDF4",
  axis: "#667083",
} as const;

/** Compact axis labels (e.g. 12.5K) — full values are in the tooltip. */
export function compactAxisFormatter(currency: string) {
  const nf = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
  return (value: number) => {
    void currency;
    return nf.format(value);
  };
}

interface Payload {
  color?: string;
  stroke?: string;
  fill?: string;
  name?: string;
  value?: number;
  payload?: { fill?: string; color?: string };
}

/** Shared Recharts tooltip: label, coloured series keys, tabular currency values. */
export function ChartTooltip({
  active,
  payload,
  label,
  currency,
  showPercentOf,
}: {
  active?: boolean;
  payload?: Payload[];
  label?: string;
  currency: string;
  showPercentOf?: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[10rem] rounded-lg border border-border bg-white px-3 py-2 shadow-popover">
      {label && <p className="mb-1.5 text-xs font-semibold text-main">{label}</p>}
      <div className="space-y-1">
        {payload.map((entry, index) => {
          const color = entry.color || entry.stroke || entry.payload?.fill || entry.fill || entry.payload?.color;
          const value = entry.value ?? 0;
          return (
            <div key={index} className="flex items-center justify-between gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                {entry.name}
              </span>
              <span className="font-semibold tabular-nums text-main">
                {formatCurrency(value, currency)}
                {showPercentOf ? (
                  <span className="ml-1 font-normal text-muted-foreground">
                    ({showPercentOf > 0 ? Math.round((value / showPercentOf) * 1000) / 10 : 0}%)
                  </span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
