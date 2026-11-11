import React from "react";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { Footer } from "@/components/layout/Footer";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col justify-between bg-muted">
      {/* Auth Header */}
      <header className="flex h-16 items-center px-6 sm:px-12">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
            <Wallet className="h-4 w-4" />
          </div>
          <span className="text-xl font-semibold tracking-tight text-main">Spendly</span>
        </Link>
      </header>

      {/* Main Container */}
      <main className="flex flex-1 items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <Footer />
    </div>
  );
}
