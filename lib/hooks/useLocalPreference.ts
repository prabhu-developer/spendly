"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Per-device UI preference (column visibility/sizes, saved views). Storage can be
 * unavailable (private mode, blocked storage) — always falls back to the default.
 */
export function useLocalPreference<T>(key: string | null, fallback: T) {
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    if (!key) return;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setValue(JSON.parse(raw) as T);
    } catch {
      /* ignore */
    }
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        if (key) {
          try {
            window.localStorage.setItem(key, JSON.stringify(resolved));
          } catch {
            /* ignore */
          }
        }
        return resolved;
      });
    },
    [key]
  );

  return [value, update] as const;
}
