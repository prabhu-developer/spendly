"use client";

import { Wallet } from "lucide-react";
import { useEffect, useState } from "react";

const FALLBACK_TIMEOUT_MS = 2500;
const EXIT_ANIMATION_MS = 220;
const FONT_WAIT_TIMEOUT_MS = 1200;

export function PWABootScreen() {
  const [isReady, setIsReady] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let fallbackTimer: number | undefined;
    let fontTimeoutTimer: number | undefined;
    const hide = () => {
      if (cancelled) return;
      setIsReady(true);
      if (fallbackTimer !== undefined) {
        window.clearTimeout(fallbackTimer);
      }
    };
    const fontTimeout = new Promise<void>((resolve) => {
      fontTimeoutTimer = window.setTimeout(resolve, FONT_WAIT_TIMEOUT_MS);
    });
    fallbackTimer = window.setTimeout(hide, FALLBACK_TIMEOUT_MS);

    void Promise.race([document.fonts.ready.then(() => undefined), fontTimeout])
      .then(
        () =>
          new Promise<void>((resolve) => {
            window.requestAnimationFrame(() => {
              window.requestAnimationFrame(() => resolve());
            });
          })
      )
      .then(hide)
      .catch(hide)
      .finally(() => {
        if (fontTimeoutTimer !== undefined) {
          window.clearTimeout(fontTimeoutTimer);
        }
      });

    return () => {
      cancelled = true;
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
      if (fontTimeoutTimer !== undefined) window.clearTimeout(fontTimeoutTimer);
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    const exitTimer = window.setTimeout(
      () => setIsVisible(false),
      EXIT_ANIMATION_MS
    );
    return () => window.clearTimeout(exitTimer);
  }, [isReady]);

  if (!isVisible) return null;

  return (
    <div
      className={`spendly-boot-screen${isReady ? " spendly-boot-screen-ready" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Spendly is getting ready"
      aria-hidden={isReady}
    >
      <div className="spendly-boot-content">
        <div className="spendly-boot-brand">
          <div className="spendly-boot-logo" aria-hidden="true">
            <Wallet size={32} strokeWidth={1.8} />
          </div>
          <h1 className="spendly-boot-title">Spendly</h1>
        </div>

        <div className="spendly-boot-progress" aria-hidden="true" />
        <p className="spendly-boot-message">Getting things ready...</p>
      </div>
    </div>
  );
}
