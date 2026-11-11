"use client";

import { resolveSyncAction, type DraftStatus } from "./syncLogic";

export { isNetworkError } from "./syncLogic";
export type { DraftStatus } from "./syncLogic";

/** Same shape as the POST /api/transactions body. */
export interface TransactionDraftPayload {
  title: string;
  amount: number;
  currency: string;
  type: "income" | "expense";
  categoryId: string;
  date: string;
  paymentMethod?: string;
  notes?: string;
  accountId?: string | null;
}

export interface TransactionDraft {
  id: string;
  userId: string;
  clientRequestId: string;
  payload: TransactionDraftPayload;
  status: DraftStatus;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncResult {
  synced: number;
  flagged: number;
  remaining: number;
  stoppedReason?: "unauthorized" | "network" | "server";
  /** True when another tab/run already held the sync lock. */
  skipped?: boolean;
}

const DB_NAME = "spendly-offline";
const STORE = "transactionDrafts";
const DB_VERSION = 1;
const CHANNEL = "spendly-offline-drafts";
const LOCK_NAME = "spendly-sync-drafts";
export const SYNC_TAG = "spendly-sync-drafts";
export const SYNC_EVENT = "spendly:sync-drafts";

function hasIndexedDB() {
  return typeof indexedDB !== "undefined";
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!hasIndexedDB()) return Promise.reject(new Error("IndexedDB is not available"));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("userId", "userId", { unique: false });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb();
  const tx = db.transaction(STORE, mode);
  const result = await promisify(fn(tx.objectStore(STORE)));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  return result;
}

// ---------- cross-tab notifications ----------

type Listener = () => void;
const listeners = new Set<Listener>();
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = () => listeners.forEach((l) => l());
  }
  return channel;
}

function notify() {
  listeners.forEach((l) => l());
  try {
    getChannel()?.postMessage("changed");
  } catch {
    /* channel closed */
  }
}

/** Subscribe to draft changes in this tab and other tabs. Returns unsubscribe. */
export function subscribeDrafts(listener: Listener): () => void {
  listeners.add(listener);
  getChannel();
  return () => {
    listeners.delete(listener);
  };
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// ---------- CRUD ----------

export async function queueTransactionDraft(
  userId: string,
  payload: TransactionDraftPayload
): Promise<TransactionDraft> {
  const now = new Date().toISOString();
  const draft: TransactionDraft = {
    id: newId(),
    userId,
    clientRequestId: newId(),
    payload,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  await withStore("readwrite", (store) => store.put(draft));
  notify();
  void registerDraftSync();
  return draft;
}

export async function listDrafts(userId: string): Promise<TransactionDraft[]> {
  if (!hasIndexedDB()) return [];
  const drafts = await withStore<TransactionDraft[]>("readonly", (store) =>
    store.index("userId").getAll(IDBKeyRange.only(userId))
  );
  return drafts.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function deleteDraft(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
  notify();
}

async function putDraft(draft: TransactionDraft): Promise<void> {
  await withStore("readwrite", (store) => store.put(draft));
}

/** Remove every draft for a user (e.g. on logout from a shared device). */
export async function clearDrafts(userId: string): Promise<void> {
  if (!hasIndexedDB()) return;
  const drafts = await listDrafts(userId);
  for (const d of drafts) {
    await withStore("readwrite", (store) => store.delete(d.id));
  }
  notify();
}

/** Ask the service worker to fire a Background Sync when connectivity returns. */
export async function registerDraftSync(): Promise<void> {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const sync = (registration as ServiceWorkerRegistration & {
      sync?: { register: (tag: string) => Promise<void> };
    })?.sync;
    if (sync) await sync.register(SYNC_TAG);
  } catch {
    /* Background Sync unsupported or denied — the online listener still syncs */
  }
}

// ---------- sync ----------

let inFlight: Promise<SyncResult> | null = null;

async function runSync(userId: string): Promise<SyncResult> {
  const drafts = (await listDrafts(userId)).filter((d) => d.status === "pending");
  let synced = 0;
  let flagged = 0;
  let stoppedReason: SyncResult["stoppedReason"];

  for (const draft of drafts) {
    let outcome: { status: number; body?: unknown } | { networkError: true };
    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft.payload, clientRequestId: draft.clientRequestId }),
      });
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = undefined;
      }
      outcome = { status: response.status, body };
    } catch {
      outcome = { networkError: true };
    }

    const action = resolveSyncAction(outcome);
    if (action.kind === "delete") {
      await withStore("readwrite", (store) => store.delete(draft.id));
      synced++;
    } else if (action.kind === "flag") {
      await putDraft({
        ...draft,
        status: "needs_attention",
        error: action.error,
        updatedAt: new Date().toISOString(),
      });
      flagged++;
    } else {
      stoppedReason = action.reason;
      break;
    }
  }

  const remaining = (await listDrafts(userId)).length;
  if (synced || flagged) notify();
  return { synced, flagged, remaining, stoppedReason };
}

/**
 * POST pending drafts one at a time. Single-flight within the tab and, where
 * the Web Locks API exists, across tabs (other tabs skip instead of double-posting;
 * the server's clientRequestId idempotency is the final safety net).
 */
export function syncDrafts(userId: string): Promise<SyncResult> {
  if (inFlight) return inFlight;
  const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;

  const run = locks
    ? (locks.request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
        if (!lock) {
          const remaining = hasIndexedDB() ? (await listDrafts(userId)).length : 0;
          return { synced: 0, flagged: 0, remaining, skipped: true } as SyncResult;
        }
        return runSync(userId);
      }) as unknown as Promise<SyncResult>) // request() resolves with the callback's result
    : runSync(userId);

  inFlight = run.finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** Return a needs_attention draft to the pending queue (after the user reviews it). */
export async function retryDraft(id: string): Promise<void> {
  const draft = await withStore<TransactionDraft | undefined>("readonly", (store) => store.get(id));
  if (!draft) return;
  await putDraft({ ...draft, status: "pending", error: undefined, updatedAt: new Date().toISOString() });
  notify();
}
