import React from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import {
  Wallet,
  ArrowRight,
  TrendingUp,
  PieChart,
  Globe2,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/layout/Footer";

export default async function HomePage() {
  const session = await getCurrentUser();

  if (session && session.userId) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col justify-between bg-[#F3F6FC]">
      {/* Navigation Bar */}
      <header className="border-b border-[#E8EDF4] bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2878E5] text-white shadow-sm">
              <Wallet className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-[#202735]">Spendly</span>
          </div>

          <div className="flex items-center gap-1 sm:gap-3">
            <Link href="/login">
              <Button variant="ghost" className="h-9 px-2 text-xs font-semibold text-[#202735] sm:px-4">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button className="h-9 bg-[#2878E5] px-2 text-xs font-semibold hover:bg-[#1F65C2] sm:px-4">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 lg:px-8 sm:py-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E8EDF4] bg-white px-3.5 py-1 text-xs font-medium text-[#2878E5] shadow-sm mb-6">
            <span className="flex h-2 w-2 rounded-full bg-[#269B72]" />
            Spendly Finance OS &bull; Live Multi-Currency Intelligence
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-[#202735] sm:text-5xl lg:text-6xl">
            Smarter Personal Finance for the Modern Era.
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base text-[#8992A3] sm:text-lg">
            Track income and expenses, monitor category budgets, view deep reporting insights, and seamlessly convert across 10 global currencies.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="gap-2 bg-[#2878E5] text-sm font-semibold hover:bg-[#1F65C2]">
                Create Free Account
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="border-[#E8EDF4] bg-white text-sm font-semibold text-[#202735]">
                Sign In to Dashboard
              </Button>
            </Link>
          </div>

          {/* Feature Highlights Grid */}
          <div className="mt-20 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 text-left">
            <div className="rounded-xl border border-[#E8EDF4] bg-white p-6 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EBF3FC] text-[#2878E5] mb-4">
                <Globe2 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-[#202735]">10 Currencies</h3>
              <p className="mt-1 text-xs text-[#8992A3]">
                USD, INR, EUR, GBP, AED, SGD, CAD, AUD, JPY, and SAR with real-time rate conversion.
              </p>
            </div>

            <div className="rounded-xl border border-[#E8EDF4] bg-white p-6 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF6F1] text-[#269B72] mb-4">
                <TrendingUp className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-[#202735]">Complete Tracking</h3>
              <p className="mt-1 text-xs text-[#8992A3]">
                Log transactions with rich metadata, search, custom date filters, and multi-field sorting.
              </p>
            </div>

            <div className="rounded-xl border border-[#E8EDF4] bg-white p-6 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FEF8EC] text-[#E9B949] mb-4">
                <PieChart className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-[#202735]">Category Budgets</h3>
              <p className="mt-1 text-xs text-[#8992A3]">
                Set monthly targets, detect threshold risks, and receive early overrun warnings.
              </p>
            </div>

            <div className="rounded-xl border border-[#E8EDF4] bg-white p-6 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EBF3FC] text-[#2878E5] mb-4">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-[#202735]">Strict Isolation</h3>
              <p className="mt-1 text-xs text-[#8992A3]">
                Server-side verified sessions, HTTP-only cookies, bcrypt hashing, and strict multi-user privacy.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
