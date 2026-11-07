"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  PieChart,
  BarChart3,
  Tags,
  Settings,
  LogOut,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api/client";

interface SidebarProps {
  user?: {
    name: string;
    email: string;
    preferredCurrency: string;
  } | null;
  className?: string;
  onNavigate?: () => void;
}

export const navItems = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Transactions", href: "/dashboard/transactions", icon: Receipt },
  { label: "Budgets", href: "/dashboard/budgets", icon: PieChart },
  { label: "Reports", href: "/dashboard/reports", icon: BarChart3 },
  { label: "Categories", href: "/dashboard/categories", icon: Tags },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar({ user, className, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await apiClient.post("/auth/logout");
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Logout failed:", err);
      router.push("/login");
    }
  };

  return (
    <aside
      className={cn(
        "flex h-full w-64 flex-col justify-between border-r border-[#E8EDF4] bg-white p-5",
        className
      )}
    >
      <div>
        {/* Brand / Logo */}
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-3 px-2 py-1 text-[#202735]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2878E5] text-white shadow-sm">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-[#202735]">
              Spendly
            </span>
            <span className="block text-[11px] font-medium tracking-wider text-[#8992A3]">
              FINANCE OS
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="mt-8 space-y-1.5">
          {navItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[#2878E5] text-white"
                    : "text-[#202735] hover:bg-[#F3F6FC] hover:text-[#2878E5]"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 transition-colors",
                    isActive ? "text-white" : "text-[#8992A3]"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User profile & Logout */}
      <div className="border-t border-[#E8EDF4] pt-4">
        {user && (
          <div className="mb-3 flex items-center gap-3 px-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EAF6F1] font-semibold text-[#269B72]">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[#202735]">{user.name}</p>
              <p className="truncate text-xs text-[#8992A3]">{user.email}</p>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3.5 py-2 text-sm font-medium text-[#8992A3] transition-colors hover:bg-[#FDF1EE] hover:text-[#F07862]"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    </aside>
  );
}
