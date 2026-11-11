import {
  CacheFirst,
  ExpirationPlugin,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
  type PrecacheEntry,
  type SerwistGlobalConfig,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Runtime cache names in use. Bump a version to invalidate; anything else
// prefixed "spendly-" is deleted on activate.
const CACHE_NAMES = {
  static: "spendly-static-v1",
  fonts: "spendly-fonts-v1",
  icons: "spendly-icons-v1",
  public: "spendly-public-v1",
} as const;
const ACTIVE_CACHES = new Set<string>(Object.values(CACHE_NAMES));

/** Must match SYNC_TAG in lib/offline/drafts.ts */
const DRAFT_SYNC_TAG = "spendly-sync-drafts";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: false,
  navigationPreload: true,
  runtimeCaching: [
    // Financial data is never cached by the service worker.
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ url }) =>
        url.origin === self.location.origin &&
        url.pathname.startsWith("/_next/static/"),
      handler: new CacheFirst({
        cacheName: CACHE_NAMES.static,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24 * 365,
          }),
        ],
      }),
    },
    {
      matcher: ({ request, url }) =>
        url.origin === self.location.origin && request.destination === "font",
      handler: new CacheFirst({
        cacheName: CACHE_NAMES.fonts,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 20,
            maxAgeSeconds: 60 * 60 * 24 * 365,
          }),
        ],
      }),
    },
    {
      matcher: ({ request, url }) =>
        url.origin === self.location.origin &&
        request.destination === "image" &&
        url.pathname.startsWith("/icons/"),
      handler: new CacheFirst({
        cacheName: CACHE_NAMES.icons,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 20,
            maxAgeSeconds: 60 * 60 * 24 * 30,
          }),
        ],
      }),
    },
    {
      matcher: ({ url }) =>
        url.origin === self.location.origin &&
        url.pathname === "/manifest.webmanifest",
      handler: new StaleWhileRevalidate({
        cacheName: CACHE_NAMES.public,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 4,
            maxAgeSeconds: 60 * 60 * 24 * 7,
          }),
        ],
      }),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.mode === "navigate",
      },
    ],
  },
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

// Remove runtime caches from previous versions.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("spendly-") && !ACTIVE_CACHES.has(key))
          .map((key) => caches.delete(key))
      )
    )
  );
});

// Background Sync: wake open Spendly windows so they sync offline drafts using
// their own cookie session (the worker never touches financial payloads itself).
interface SyncEventLike extends ExtendableEvent {
  tag: string;
}
self.addEventListener("sync", (event) => {
  const syncEvent = event as SyncEventLike;
  if (syncEvent.tag !== DRAFT_SYNC_TAG) return;
  syncEvent.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) client.postMessage({ type: "SYNC_DRAFTS" });
      })
  );
});

serwist.addEventListeners();
