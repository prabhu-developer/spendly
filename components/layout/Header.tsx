"use client";

import React, { useState } from "react";
import { Menu, Plus, Bell, Calendar as CalendarIcon, User as UserIcon, LogOut, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { format } from "date-fns";

interface HeaderProps {
  user?: {
    name: string;
    email: string;
    preferredCurrency: string;
  } | null;
  onOpenMobileMenu?: () => void;
  onOpenAddTransaction?: () => void;
  title?: string;
}

export function Header({
  user,
  onOpenMobileMenu,
  onOpenAddTransaction,
  title = "Overview",
}: HeaderProps) {
  const router = useRouter();
  const [hasUnreadNotification, setHasUnreadNotification] = useState(true);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const handleLogout = async () => {
    try {
      await apiClient.post("/auth/logout");
      router.push("/login");
      router.refresh();
    } catch (err) {
      router.push("/login");
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#E8EDF4] bg-white/95 px-4 backdrop-blur sm:px-6">
      {/* Mobile menu button & Title */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5 text-[#202735]" />
        </Button>

        <div>
          <h1 className="text-lg font-bold text-[#202735] sm:text-xl">{title}</h1>
          {user && (
            <p className="hidden text-xs text-[#8992A3] sm:block">
              {getGreeting()}, <span className="font-medium text-[#202735]">{user.name}</span>
            </p>
          )}
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Date badge */}
        <div className="hidden items-center gap-1.5 rounded-lg border border-[#E8EDF4] bg-[#F3F6FC] px-3 py-1.5 text-xs font-medium text-[#8992A3] md:flex">
          <CalendarIcon className="h-3.5 w-3.5 text-[#2878E5]" />
          <span>{format(new Date(), "EEE, dd MMM yyyy")}</span>
        </div>

        {/* Notifications area */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="relative h-9 w-9 rounded-lg border-[#E8EDF4]"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4 text-[#8992A3]" />
              {hasUnreadNotification && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#2878E5]" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 p-2">
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-xs font-semibold text-[#202735]">Notifications</span>
              {hasUnreadNotification && (
                <button
                  onClick={() => setHasUnreadNotification(false)}
                  className="text-[11px] text-[#2878E5] hover:underline"
                >
                  Mark as read
                </button>
              )}
            </div>
            <DropdownMenuSeparator />
            <div className="py-2 text-center text-xs text-[#8992A3]">
              {hasUnreadNotification ? (
                <div className="rounded-md bg-[#F3F6FC] p-2.5 text-left text-xs">
                  <p className="font-medium text-[#202735]">Currency Rates Live</p>
                  <p className="mt-0.5 text-[11px] text-[#8992A3]">
                    Exchange rates are actively synchronized for global reporting.
                  </p>
                </div>
              ) : (
                "No new notifications"
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Quick Add Transaction Button */}
        {onOpenAddTransaction && (
          <Button
            onClick={onOpenAddTransaction}
            className="h-9 gap-1.5 rounded-lg bg-[#2878E5] px-3 text-xs font-medium hover:bg-[#1F65C2] sm:px-4 sm:text-sm"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Transaction</span>
            <span className="sm:hidden">Add</span>
          </Button>
        )}

        {/* User profile menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2878E5] p-0 font-semibold text-white hover:bg-[#1F65C2]"
            >
              {user?.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="h-4 w-4" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium text-[#202735]">{user?.name || "User"}</p>
                <p className="text-xs text-[#8992A3] truncate">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => router.push("/dashboard/settings")}
              className="cursor-pointer gap-2"
            >
              <SettingsIcon className="h-4 w-4 text-[#8992A3]" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer gap-2 text-[#F07862] focus:bg-[#FDF1EE] focus:text-[#F07862]"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
