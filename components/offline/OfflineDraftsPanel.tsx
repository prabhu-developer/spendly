"use client";

import { AlertTriangle, CloudOff, RefreshCw, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { formatCurrency, isValidCurrency } from "@/lib/currency/currencies";
import { useOfflineDrafts } from "@/lib/offline/useOfflineDrafts";
import { cn } from "@/lib/utils";

interface OfflineDraftsPanelProps {
  userId: string;
  className?: string;
}

/**
 * Shows transactions saved on this device while offline. Renders nothing when
 * there are no drafts, so it can be mounted unconditionally (e.g. on the
 * dashboard and transactions pages).
 */
export function OfflineDraftsPanel({ userId, className }: OfflineDraftsPanelProps) {
  const { drafts, pendingCount, attentionCount, isSyncing, sync, discard, retry } =
    useOfflineDrafts(userId);

  if (drafts.length === 0) return null;

  return (
    <section
      aria-label="Offline transactions"
      className={cn("rounded-xl border border-warning/40 bg-warning-light p-4 shadow-card", className)}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-warning-foreground">
            <CloudOff className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-main">
              {pendingCount > 0
                ? `${pendingCount} ${pendingCount === 1 ? "transaction" : "transactions"} waiting to sync`
                : "Offline transactions need attention"}
            </p>
            <p className="text-xs text-warning-foreground">
              Saved on this device only.
              {attentionCount > 0 &&
                ` ${attentionCount} could not be saved — review below.`}
            </p>
          </div>
        </div>
        {pendingCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void sync()}
            disabled={isSyncing}
            className="w-fit"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} aria-hidden="true" />
            {isSyncing ? "Syncing…" : "Sync now"}
          </Button>
        )}
      </div>

      <ul className="mt-3 divide-y divide-warning/20 overflow-hidden rounded-lg border border-warning/30 bg-white">
        {drafts.map((draft) => {
          const { payload } = draft;
          const amount = isValidCurrency(payload.currency)
            ? formatCurrency(payload.amount, payload.currency)
            : `${payload.amount} ${payload.currency}`;
          const needsAttention = draft.status === "needs_attention";
          let dateLabel = payload.date;
          try {
            dateLabel = format(new Date(payload.date), "dd MMM yyyy");
          } catch {
            /* keep raw */
          }
          return (
            <li key={draft.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-main">{payload.title}</p>
                <p className="text-xs text-muted-foreground">
                  {dateLabel} ·{" "}
                  <span
                    className={cn(
                      "tabular-nums",
                      payload.type === "income" ? "text-income-text" : "text-expense-text"
                    )}
                  >
                    {payload.type === "income" ? "+" : "−"}
                    {amount}
                  </span>
                </p>
                {needsAttention && draft.error && (
                  <p role="alert" className="mt-1 flex items-start gap-1 text-xs text-expense-text">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                    {draft.error}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {needsAttention ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => void retry(draft.id)} disabled={isSyncing}>
                      Retry
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void discard(draft.id)}
                      className="text-expense-text hover:bg-expense-light"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Discard
                    </Button>
                  </>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    Pending
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
