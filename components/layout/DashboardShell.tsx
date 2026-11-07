"use client";

import React, { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { Footer } from "./Footer";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { SupportedCurrency } from "@/lib/currency/currencies";

const TransactionDialog = dynamic(
  () =>
    import("@/components/transactions/TransactionDialog").then(
      (module) => module.TransactionDialog
    ),
  { ssr: false }
);

interface DashboardShellProps {
  user: {
    userId: string;
    email: string;
    name: string;
    preferredCurrency: SupportedCurrency;
  };
  initialCategories: Array<{
    id: string;
    name: string;
    type: "income" | "expense";
    icon: string;
    color: string;
  }>;
  children: React.ReactNode;
}

export function DashboardShell({
  user,
  initialCategories,
  children,
}: DashboardShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [addTxOpen, setAddTxOpen] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  const handleTxSuccess = () => {
    queryClient.invalidateQueries();
    router.refresh();
  };

  return (
    <div className="flex min-h-screen bg-[#F3F6FC]">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block lg:shrink-0">
        <Sidebar user={user} className="sticky top-0 h-screen" />
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative flex w-72 max-w-[80%] flex-1 flex-col bg-white">
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute right-3 top-3 rounded-md p-1.5 text-[#8992A3] hover:bg-[#F3F6FC] hover:text-[#202735]"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <Sidebar
              user={user}
              onNavigate={() => setMobileMenuOpen(false)}
              className="h-full border-r-0 pt-6"
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        <Header
          user={user}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenAddTransaction={() => setAddTxOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>

        <Footer />
      </div>

      {/* Global Add Transaction Dialog */}
      {addTxOpen && (
        <TransactionDialog
          open={addTxOpen}
          onOpenChange={setAddTxOpen}
          categories={initialCategories}
          defaultCurrency={user.preferredCurrency}
          onSuccess={handleTxSuccess}
        />
      )}
    </div>
  );
}
