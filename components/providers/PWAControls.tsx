"use client";

import { useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function PWAControls() {
  const [isOnline, setIsOnline] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(
    null
  );
  const [isIosInstall, setIsIosInstall] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  const [installError, setInstallError] = useState(false);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    updateOnlineStatus();
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);

    const isAppleMobile =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator &&
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    setIsIosInstall(isAppleMobile && !isStandalone);

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
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
              if (
                installingWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
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
    };
  }, []);

  const installApp = async () => {
    if (!installPrompt) {
      setShowIosInstructions(true);
      return;
    }

    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
    } catch (error) {
      console.error("PWA installation prompt failed:", error);
      setInstallError(true);
    }
  };

  const activateUpdate = () => {
    if (!registration?.waiting) return;

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => window.location.reload(),
      { once: true }
    );
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  };

  return (
    <>
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="sticky top-0 z-[100] bg-[#FEF8EC] px-4 py-2 text-center text-xs font-medium text-[#735B1B]"
        >
          You’re offline. Financial data may be unavailable or out of date; no
          changes are saved offline.
        </div>
      )}

      {(installPrompt || isIosInstall || updateReady) && (
        <aside className="fixed bottom-4 right-4 z-[100] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
          {updateReady && (
            <button
              type="button"
              onClick={activateUpdate}
              className="min-h-11 rounded-lg bg-[#202735] px-4 text-sm font-semibold text-white shadow-lg"
            >
              Update Spendly
            </button>
          )}
          {(installPrompt || isIosInstall || installError) && (
            <div className="rounded-xl border border-[#E8EDF4] bg-white p-3 shadow-lg">
              {(installPrompt || isIosInstall) && (
                <button
                  type="button"
                  onClick={() =>
                    isIosInstall
                      ? setShowIosInstructions((visible) => !visible)
                      : void installApp()
                  }
                  className="min-h-11 rounded-lg bg-[#2878E5] px-4 text-sm font-semibold text-white"
                >
                  {isIosInstall ? "Add Spendly to Home Screen" : "Install Spendly"}
                </button>
              )}
              {installError && (
                <p role="status" className="text-xs text-[#F07862]">
                  The install prompt could not be opened. Try your browser menu.
                </p>
              )}
              {showIosInstructions && isIosInstall && (
                <p className="mt-2 max-w-64 text-xs leading-5 text-[#8992A3]">
                  In Safari, tap Share, then choose “Add to Home Screen”.
                </p>
              )}
            </div>
          )}
        </aside>
      )}
    </>
  );
}
