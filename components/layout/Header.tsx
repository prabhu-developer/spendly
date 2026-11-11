"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiClient } from "@/lib/api/client";
import { format } from "date-fns";
import { Calendar as CalendarIcon, LogOut, Menu, Plus, Search, Settings as SettingsIcon, User as UserIcon } from "lucide-react";
import { clearDrafts } from "@/lib/offline";
import { NotificationsMenu } from "./NotificationsMenu";
import { OPEN_COMMAND_PALETTE_EVENT } from "./CommandPalette";
import { usePathname, useRouter } from "next/navigation";
import { navItems } from "./Sidebar";

interface HeaderProps {
  user?: {
    userId?: string;
    name: string;
    email: string;
    preferredCurrency: string;
  } | null;
  onOpenMobileMenu?: () => void;
  title?: string;
}

export function Header({
  user,
  onOpenMobileMenu,
  title,
}: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const activeNavItem = navItems.find(
    (item) =>
      pathname === item.href ||
      (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`))
  );
  const pageTitle = title ?? activeNavItem?.label ?? "Overview";

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const handleLogout = async () => {
    if (user?.userId) await clearDrafts(user.userId).catch(() => undefined);
    try {
      await apiClient.post("/auth/logout");
      router.push("/login");
      router.refresh();
    } catch (err) {
      router.push("/login");
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between gap-2 border-b border-border bg-white/90 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-white/80 sm:px-6 print:hidden">
      {/* Mobile menu button & Title */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5 text-main" />
        </Button>

        <div>
          <h1 className="truncate text-lg font-semibold tracking-tight text-main">{pageTitle}</h1>
          {user && (
            <p className="hidden text-xs text-muted-foreground sm:block">
              {getGreeting()}, <span className="font-medium text-main">{user.name}</span>
            </p>
          )}
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Date badge */}
        <div className="hidden items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground xl:flex" suppressHydrationWarning>
          <CalendarIcon className="h-3.5 w-3.5 text-primary-text" />
          <span>{format(new Date(), "EEE, dd MMM yyyy")}</span>
        </div>

        {/* Global search (⌘K) */}
        <Button
          variant="outline"
          onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT))}
          className="h-9 w-9 gap-2 px-0 text-muted-foreground sm:w-auto sm:px-3"
          aria-label="Search (Ctrl+K)"
        >
          <Search className="h-4 w-4" />
          <span className="hidden text-xs font-normal sm:inline">Search</span>
          <kbd className="hidden rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground xl:inline">
            ⌘K
          </kbd>
        </Button>

        {/* Budget alerts (real data) */}
        <NotificationsMenu />

        {/* Quick Add Transaction Button */}
        <Button
          onClick={() => router.push("/dashboard/transactions/new")}
          className="hidden h-9 gap-1.5 px-3 text-xs sm:inline-flex sm:px-4 sm:text-sm"
        >
          <Plus className="h-4 w-4" />
          Add Transaction
        </Button>

        {/* User profile menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-green-900 p-0 font-semibold text-white hover:bg-primary-hover"
            >
              {user?.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="h-4 w-4" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium text-main">{user?.name || "User"}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => router.push("/dashboard/settings")}
              className="cursor-pointer gap-2"
            >
              <SettingsIcon className="h-4 w-4 text-muted-foreground" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer gap-2 text-expense-text focus:bg-expense-light focus:text-expense-text"
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
