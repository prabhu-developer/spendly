import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline — Spendly" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-border bg-white p-8 text-center shadow-card">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-warning-light text-warning-foreground">
          <WifiOff className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-main">You’re offline</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This page needs a connection. For your privacy, Spendly doesn’t store your financial
          data on this device. Transactions you add from an open Spendly window while offline
          are kept as drafts and sync automatically when you reconnect.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Try again
        </Link>
      </section>
    </main>
  );
}
