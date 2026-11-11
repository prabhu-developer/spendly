/**
 * Pure helpers for offline draft sync. No IndexedDB / DOM access here so the
 * HTTP-result → action mapping can be unit tested.
 */

export type DraftStatus = "pending" | "needs_attention";

/** What to do with a draft after an attempt to POST it. */
export type SyncAction =
  /** Server accepted (or already had it via idempotency key): remove the draft. */
  | { kind: "delete" }
  /** Server rejected the data: keep it, flag it for the user, continue with others. */
  | { kind: "flag"; error: string }
  /** Session/network problem: keep everything and stop this sync run. */
  | { kind: "stop"; reason: "unauthorized" | "network" | "server" };

export function resolveSyncAction(
  outcome: { status: number; body?: unknown } | { networkError: true }
): SyncAction {
  if ("networkError" in outcome) return { kind: "stop", reason: "network" };
  const { status, body } = outcome;
  if (status === 200 || status === 201) return { kind: "delete" };
  if (status === 401 || status === 403) return { kind: "stop", reason: "unauthorized" };
  if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
    const message =
      body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string"
        ? (body as { error: string }).error
        : "The server could not accept this transaction.";
    return { kind: "flag", error: message };
  }
  // 408/429/5xx: transient — retry later, keep data.
  return { kind: "stop", reason: "server" };
}

/**
 * True for failures where the request never got a response: axios errors
 * without `response`, fetch TypeErrors ("Failed to fetch"), aborted-offline.
 */
export function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as {
    isAxiosError?: boolean;
    response?: unknown;
    code?: string;
    name?: string;
    message?: string;
  };
  if (err.isAxiosError) {
    if (err.code === "ERR_CANCELED") return false;
    return !err.response;
  }
  if (err.name === "TypeError" && typeof err.message === "string") {
    return /fetch|network|load failed/i.test(err.message);
  }
  return false;
}
