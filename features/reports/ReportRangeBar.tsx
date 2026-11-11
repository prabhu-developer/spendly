"use client";

import { endOfMonth, format, startOfMonth, startOfYear, subMonths } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const REPORT_PRESETS = [
  { id: "thisMonth", label: "This month" },
  { id: "lastMonth", label: "Last month" },
  { id: "last3", label: "3 months" },
  { id: "last6", label: "6 months" },
  { id: "last12", label: "12 months" },
  { id: "ytd", label: "Year to date" },
] as const;
export type ReportPreset = (typeof REPORT_PRESETS)[number]["id"];

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

export function presetRange(preset: ReportPreset, today = new Date()): { from: string; to: string } {
  switch (preset) {
    case "thisMonth":
      return { from: fmt(startOfMonth(today)), to: fmt(endOfMonth(today)) };
    case "lastMonth": {
      const prev = subMonths(today, 1);
      return { from: fmt(startOfMonth(prev)), to: fmt(endOfMonth(prev)) };
    }
    case "last3":
      return { from: fmt(startOfMonth(subMonths(today, 2))), to: fmt(endOfMonth(today)) };
    case "last6":
      return { from: fmt(startOfMonth(subMonths(today, 5))), to: fmt(endOfMonth(today)) };
    case "last12":
      return { from: fmt(startOfMonth(subMonths(today, 11))), to: fmt(endOfMonth(today)) };
    case "ytd":
      return { from: fmt(startOfYear(today)), to: fmt(today) };
  }
}

export function ReportRangeBar({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
}) {
  const active = REPORT_PRESETS.find((p) => {
    const r = presetRange(p.id);
    return r.from === from && r.to === to;
  })?.id;
  const invalid = Boolean(from && to && from > to);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-white p-3 shadow-card sm:p-4 lg:flex-row lg:items-center lg:justify-between print:hidden">
      <div role="group" aria-label="Report period presets" className="flex flex-wrap gap-1.5">
        {REPORT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            aria-pressed={active === preset.id}
            onClick={() => onChange(presetRange(preset.id))}
            className={cn(
              "h-8 rounded-md border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              active === preset.id
                ? "border-primary bg-primary-light text-primary-text"
                : "border-border bg-white text-main hover:border-border-strong hover:bg-muted"
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="report-from" className="text-[11px] font-medium text-muted-foreground">
            From
          </Label>
          <Input
            id="report-from"
            type="date"
            value={from}
            max={to || undefined}
            aria-invalid={invalid}
            onChange={(e) => e.target.value && onChange({ from: e.target.value, to })}
            className="h-8 w-[9.5rem] text-xs"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="report-to" className="text-[11px] font-medium text-muted-foreground">
            To
          </Label>
          <Input
            id="report-to"
            type="date"
            value={to}
            min={from || undefined}
            aria-invalid={invalid}
            onChange={(e) => e.target.value && onChange({ from, to: e.target.value })}
            className="h-8 w-[9.5rem] text-xs"
          />
        </div>
      </div>
      {invalid && (
        <p role="alert" className="text-xs text-expense-text lg:hidden">
          The start date must be on or before the end date.
        </p>
      )}
    </div>
  );
}
