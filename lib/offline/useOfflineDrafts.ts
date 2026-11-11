"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  deleteDraft,
  listDrafts,
  retryDraft,
  subscribeDrafts,
  syncDrafts,
  SYNC_EVENT,
  type SyncResult,
  type TransactionDraft,
} from "./drafts";

const INVALIDATE_KEYS = [
  ["transactions"],
  ["reports"],
  ["reportsDetail"],
  ["recentTransactions"],
  ["budgets"],
  ["accounts"],
];

export function useOfflineDrafts(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<TransactionDraft[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setDrafts([]);
      return;
    }
    try {
      const next = await listDrafts(userId);
      if (mounted.current) setDrafts(next);
    } catch {
      /* IndexedDB unavailable (private mode): no drafts to show */
    }
  }, [userId]);

  const sync = useCallback(
    async (opts: { silent?: boolean } = {}): Promise<SyncResult | null> => {
      if (!userId) return null;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (!opts.silent) toast.info("You're offline. Drafts will sync when you reconnect.");
        return null;
      }
      setIsSyncing(true);
      try {
        const result = await syncDrafts(userId);
        if (result.synced > 0) {
          await Promise.all(
            INVALIDATE_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey }))
          );
          toast.success(
            result.synced === 1
              ? "1 offline transaction synced"
              : `${result.synced} offline transactions synced`
          );
        }
        if (result.flagged > 0) {
          toast.warning(
            `${result.flagged} offline ${result.flagged === 1 ? "transaction needs" : "transactions need"} your attention`
          );
        }
        if (!opts.silent && !result.skipped) {
          if (result.stoppedReason === "unauthorized") {
            toast.error("Please sign in again to sync your offline transactions.");
          } else if (result.stoppedReason) {
            toast.error("Couldn't reach Spendly. Your drafts are safe and will retry.");
          } else if (result.synced === 0 && result.flagged === 0) {
            toast.info("Nothing to sync");
          }
        }
        return result;
      } catch {
        if (!opts.silent) toast.error("Sync failed. Your drafts are still saved on this device.");
        return null;
      } finally {
        if (mounted.current) setIsSyncing(false);
        void refresh();
      }
    },
    [userId, queryClient, refresh]
  );

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const unsubscribe = subscribeDrafts(() => void refresh());

    const onOnline = () => void sync({ silent: true });
    const onSyncRequest = () => void sync({ silent: true });
    window.addEventListener("online", onOnline);
    window.addEventListener(SYNC_EVENT, onSyncRequest);
    if (navigator.onLine) void sync({ silent: true });

    return () => {
      mounted.current = false;
      unsubscribe();
      window.removeEventListener("online", onOnline);
      window.removeEventListener(SYNC_EVENT, onSyncRequest);
    };
  }, [refresh, sync]);

  const discard = useCallback(async (id: string) => {
    await deleteDraft(id);
  }, []);

  const retry = useCallback(
    async (id: string) => {
      await retryDraft(id);
      await sync();
    },
    [sync]
  );

  return {
    drafts,
    pendingCount: drafts.filter((d) => d.status === "pending").length,
    attentionCount: drafts.filter((d) => d.status === "needs_attention").length,
    isSyncing,
    sync,
    discard,
    retry,
    refresh,
  };
}
