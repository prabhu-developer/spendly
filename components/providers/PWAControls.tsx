"use client";

import { Download, RefreshCw, Share, X, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { SYNC_EVENT } from "@/lib/offline/drafts";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const INSTALL_DISMISS_KEY = "spendly:install-dismissed-at";
const INSTALL_DISMISS_MS = 14 * 24 * 60 * 60 * 1000;

function wasInstallDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(INSTALL_DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    return Number.isFinite(at) && Date.now() - at < INSTALL_DISMISS_MS;
  } catch {
    return false;
  }
}

function rememberInstallDismissed() {
  try {
    localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
  } catch {
    /* storage blocked — prompt may reappear next visit */
  }
}

export function PWAControls() {
  const [isOnline, setIsOnline] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [isIosInstall, setIsIosInstall] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(true);
  const [updateReady, setUpdateReady] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [installError, setInstallError] = useState(false);

  useEffect(() => {
    setInstallDismissed(wasInstallDismissedRecently());

    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    updateOnlineStatus();
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    const isAppleMobile =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator &&
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    setIsIosInstall(isAppleMobile && !isStandalone);

    // Bridge Background Sync wake-ups from the service worker to the drafts hook.
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === "SYNC_DRAFTS") {
        window.dispatchEvent(new Event(SYNC_EVENT));
      }
    };

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handleSwMessage);
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((serviceWorkerRegistration) => {
          setRegistration(serviceWorkerRegistration);
          if (serviceWorkerRegistration.waiting && navigator.serviceWorker.controller) {
            setUpdateReady(true);
          }

          serviceWorkerRegistration.addEventListener("updatefound", () => {
            const installingWorker = serviceWorkerRegistration.installing;
            installingWorker?.addEventListener("statechange", () => {
              if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                setUpdateReady(true);
              }
            });
          });
        })
        .catch((error: unknown) => {
          console.error("Service worker registration failed:", error);
        });
    }

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", handleSwMessage);
      }
    };
  }, []);

  const dismissInstall = () => {
    rememberInstallDismissed();
    setInstallDismissed(true);
  };

  const installApp = async () => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "dismissed") rememberInstallDismissed();
      setInstallPrompt(null);
      setInstallDismissed(true);
    } catch (error) {
      console.error("PWA installation prompt failed:", error);
      setInstallError(true);
    }
  };

  const activateUpdate = () => {
    if (!registration?.waiting) {
      window.location.reload();
      return;
    }
    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), {
      once: true,
    });
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  };

  const showInstall = !installDismissed && (Boolean(installPrompt) || isIosInstall);

  return (
    <>
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="sticky top-0 z-[100] flex items-center justify-center gap-2 bg-warning-light px-4 py-2 text-center text-xs font-medium text-warning-foreground print:hidden"
        >
          <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          You’re offline. New transactions are saved on this device and will sync when you
          reconnect.
        </div>
      )}

      {(showInstall || updateReady) && (
        <aside
          aria-label="App notifications"
          className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-[100] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2 print:hidden max-lg:bottom-[calc(5rem+env(safe-area-inset-bottom))]"
        >
          {updateReady && (
            <div
              role="status"
              className="flex items-center gap-3 rounded-xl border border-border bg-white p-3 shadow-popover animate-slide-up"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary-text">
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-main">A new version of Spendly is ready</p>
                <p className="text-xs text-muted-foreground">Reload to get the latest improvements.</p>
              </div>
              <button
                type="button"
                onClick={activateUpdate}
                className="inline-flex h-9 shrink-0 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                Reload
              </button>
            </div>
          )}

          {showInstall && (
            <div className="relative rounded-xl border border-border bg-white p-3 pr-9 shadow-popover animate-slide-up">
              <button
                type="button"
                onClick={dismissInstall}
                aria-label="Dismiss install prompt"
                className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary-text">
                  {isIosInstall ? (
                    <Share className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Download className="h-4 w-4" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-main">Install Spendly</p>
                  {isIosInstall ? (
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                      In Safari, tap <span className="font-medium text-main">Share</span>, then
                      choose <span className="font-medium text-main">Add to Home Screen</span>.
                    </p>
                  ) : (
                    <>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Quick access from your home screen, and record transactions offline.
                      </p>
                      <div className="mt-2.5 flex gap-2">
                        <button
                          type="button"
                          onClick={() => void installApp()}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        >
                          <Download className="h-3.5 w-3.5" aria-hidden="true" />
                          Install
                        </button>
                        <button
                          type="button"
                          onClick={dismissInstall}
                          className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-main"
                        >
                          Not now
                        </button>
                      </div>
                    </>
                  )}
                  {installError && (
                    <p role="status" className="mt-2 text-xs text-expense-text">
                      The install prompt couldn’t open. Use your browser menu to install.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </aside>
      )}
    </>
  );
}
