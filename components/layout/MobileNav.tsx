"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, LayoutDashboard, Menu, Plus, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Activity", href: "/dashboard/transactions", icon: Receipt },
  { label: "Reports", href: "/dashboard/reports", icon: BarChart3 },
];

/** Thumb-reachable bottom navigation for phones; the full menu stays in the drawer. */
export function MobileNav({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href) && !pathname.endsWith("/new");

  const linkClass = (active: boolean) =>
    cn(
      "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
      active ? "text-primary-text" : "text-muted-foreground"
    );

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden"
    >
      <div className="mx-auto flex h-16 max-w-md items-stretch">
        {items.slice(0, 2).map(({ label, href, icon: Icon }) => (
          <Link key={href} href={href} className={linkClass(isActive(href))} aria-current={isActive(href) ? "page" : undefined}>
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
        <div className="flex flex-1 items-center justify-center">
          <Link
            href="/dashboard/transactions/new"
            aria-label="Add transaction"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-card-hover transition-transform active:scale-95"
          >
            <Plus className="h-6 w-6" />
          </Link>
        </div>
        {items.slice(2).map(({ label, href, icon: Icon }) => (
          <Link key={href} href={href} className={linkClass(isActive(href))} aria-current={isActive(href) ? "page" : undefined}>
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
        <button type="button" onClick={onOpenMenu} className={linkClass(false)} aria-label="Open full menu">
          <Menu className="h-5 w-5" />
          More
        </button>
      </div>
    </nav>
  );
}
