"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Toaster } from "sonner";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { MobileNav } from "./MobileNav";
import { CommandPalette } from "./CommandPalette";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { SupportedCurrency } from "@/lib/currency/currencies";

interface DashboardShellProps {
  user: {
    userId: string;
    email: string;
    name: string;
    preferredCurrency: SupportedCurrency;
  };
  children: React.ReactNode;
}

export function DashboardShell({ user, children }: DashboardShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer on navigation and on Escape
  useEffect(() => setMobileMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen]);

  return (
    <TooltipProvider delayDuration={300}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-text focus:shadow-popover"
      >
        Skip to content
      </a>
      <div className="flex min-h-screen bg-background">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block lg:shrink-0 print:hidden">
          <Sidebar user={user} className="sticky top-0 h-screen" />
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
            <div
              className="fixed inset-0 bg-main/40 backdrop-blur-[2px] animate-fade-in"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative flex w-72 max-w-[80%] flex-1 flex-col bg-white shadow-popover animate-slide-up">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-main"
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
        <div className="flex min-w-0 flex-1 flex-col">
          <Header user={user} onOpenMobileMenu={() => setMobileMenuOpen(true)} />

          <main id="main-content" tabIndex={-1} className="flex-1 p-4 pb-24 focus:outline-none sm:p-6 sm:pb-24 lg:p-8">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>

          <div className="hidden lg:block print:hidden">
            <Footer />
          </div>
        </div>
      </div>

      <MobileNav onOpenMenu={() => setMobileMenuOpen(true)} />
      <CommandPalette />
      <Toaster
        position="top-center"
        closeButton
        toastOptions={{
          classNames: {
            toast: "!rounded-xl !border !border-border !bg-white !text-main !shadow-popover !font-sans",
            description: "!text-muted-foreground",
          },
        }}
      />
    </TooltipProvider>
  );
}
