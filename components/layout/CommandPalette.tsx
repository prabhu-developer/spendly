"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowDownRight, ArrowUpRight, CornerDownLeft, Keyboard, Plus, Search } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { formatCurrency } from "@/lib/currency/currencies";
import { cn } from "@/lib/utils";
import { navItems } from "./Sidebar";

export const OPEN_COMMAND_PALETTE_EVENT = "spendly:open-command-palette";

type PaletteItem = {
  id: string;
  label: string;
  hint?: string;
  group: "Actions" | "Go to" | "Transactions";
  icon: React.ReactNode;
  run: () => void;
};

export const KEYBOARD_SHORTCUTS: { keys: string[]; description: string }[] = [
  { keys: ["⌘/Ctrl", "K"], description: "Open search & commands" },
  { keys: ["N"], description: "Add a transaction" },
  { keys: ["/"], description: "Focus the page search" },
  { keys: ["G", "O"], description: "Go to Overview" },
  { keys: ["G", "T"], description: "Go to Transactions" },
  { keys: ["G", "A"], description: "Go to Accounts" },
  { keys: ["G", "B"], description: "Go to Budgets" },
  { keys: ["G", "R"], description: "Go to Reports" },
  { keys: ["?"], description: "Show keyboard shortcuts" },
];

const GOTO_KEYS: Record<string, string> = {
  o: "/dashboard",
  t: "/dashboard/transactions",
  a: "/dashboard/accounts",
  b: "/dashboard/budgets",
  r: "/dashboard/reports",
  c: "/dashboard/categories",
  s: "/dashboard/settings",
};

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) ||
    el.getAttribute("role") === "combobox"
  );
}

/** Global search (⌘K) + keyboard shortcuts. Mounted once in the dashboard shell. */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const debounced = useDebouncedValue(query.trim(), 200);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  // Global key handling
  useEffect(() => {
    let gPressedAt = 0;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (document.querySelector("[role=dialog]")) return; // don't fire under open dialogs

      const key = e.key.toLowerCase();
      if (Date.now() - gPressedAt < 1000 && GOTO_KEYS[key]) {
        e.preventDefault();
        gPressedAt = 0;
        router.push(GOTO_KEYS[key]);
        return;
      }
      if (key === "g") {
        gPressedAt = Date.now();
      } else if (key === "n") {
        e.preventDefault();
        router.push("/dashboard/transactions/new");
      } else if (e.key === "?") {
        e.preventDefault();
        setShowShortcuts(true);
      } else if (e.key === "/") {
        const search = document.querySelector<HTMLInputElement>("[data-page-search]");
        if (search) {
          e.preventDefault();
          search.focus();
        }
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
    };
  }, [router]);

  const { data: txResults, isFetching } = useQuery({
    queryKey: ["paletteSearch", debounced],
    enabled: open && debounced.length >= 2,
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({
        search: debounced,
        limit: "6",
        compact: "true",
        includeTotal: "false",
      });
      return (await apiClient.get(`/transactions?${params}`, { signal })).data.transactions as {
        id: string;
        title: string;
        amount: number;
        currency: string;
        type: "income" | "expense";
        date: string;
        category: { name: string };
      }[];
    },
  });

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();
    const go = (href: string) => () => {
      close();
      router.push(href);
    };
    const actions: PaletteItem[] = [
      { id: "new-tx", label: "Add transaction", hint: "N", group: "Actions", icon: <Plus className="h-4 w-4" />, run: go("/dashboard/transactions/new") },
      { id: "new-account", label: "Add account", group: "Actions", icon: <Plus className="h-4 w-4" />, run: go("/dashboard/accounts?new=1") },
      {
        id: "shortcuts",
        label: "Keyboard shortcuts",
        hint: "?",
        group: "Actions",
        icon: <Keyboard className="h-4 w-4" />,
        run: () => {
          close();
          setShowShortcuts(true);
        },
      },
    ];
    const pages: PaletteItem[] = navItems.map((n) => {
      const Icon = n.icon;
      return { id: n.href, label: n.label, group: "Go to", icon: <Icon className="h-4 w-4" />, run: go(n.href) };
    });
    const matches = (i: PaletteItem) => !q || i.label.toLowerCase().includes(q);
    const tx: PaletteItem[] =
      debounced.length >= 2
        ? (txResults ?? []).map((t) => ({
            id: `tx-${t.id}`,
            label: t.title,
            hint: `${t.type === "income" ? "+" : "−"}${formatCurrency(t.amount, t.currency)}`,
            group: "Transactions",
            icon:
              t.type === "income" ? (
                <ArrowUpRight className="h-4 w-4 text-income-text" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-expense-text" />
              ),
            run: go(`/dashboard/transactions?search=${encodeURIComponent(t.title)}`),
          }))
        : [];
    const searchAll: PaletteItem[] =
      q.length >= 2
        ? [
            {
              id: "search-all",
              label: `Search all transactions for “${query.trim()}”`,
              group: "Transactions",
              icon: <Search className="h-4 w-4" />,
              run: go(`/dashboard/transactions?search=${encodeURIComponent(query.trim())}`),
            },
          ]
        : [];
    return [...actions.filter(matches), ...pages.filter(matches), ...tx, ...searchAll];
  }, [query, debounced, txResults, router, close]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[active]?.run();
    }
  };

  let lastGroup = "";
  return (
    <>
      <DialogPrimitive.Root open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-main/30 backdrop-blur-[2px] animate-fade-in" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-white shadow-popover animate-slide-up focus:outline-none"
          >
            <DialogPrimitive.Title className="sr-only">Search and commands</DialogPrimitive.Title>
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Search transactions, pages and actions…"
                className="h-12 w-full bg-transparent text-sm text-main outline-none placeholder:text-muted-foreground"
                role="combobox"
                aria-expanded="true"
                aria-controls="command-palette-list"
                aria-activedescendant={items[active] ? `cmd-${items[active].id}` : undefined}
              />
              {isFetching && <span className="text-[11px] text-muted-foreground">Searching…</span>}
            </div>
            <div ref={listRef} id="command-palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
              {items.length === 0 && (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">No results</p>
              )}
              {items.map((item, index) => {
                const header = item.group !== lastGroup ? item.group : null;
                lastGroup = item.group;
                return (
                  <div key={item.id}>
                    {header && (
                      <p className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {header}
                      </p>
                    )}
                    <button
                      id={`cmd-${item.id}`}
                      data-index={index}
                      role="option"
                      aria-selected={index === active}
                      onMouseMove={() => setActive(index)}
                      onClick={item.run}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-main",
                        index === active && "bg-muted"
                      )}
                    >
                      <span className="text-muted-foreground">{item.icon}</span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.hint && (
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{item.hint}</span>
                      )}
                      {index === active && <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <DialogPrimitive.Root open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-main/30 animate-fade-in" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-white p-5 shadow-popover animate-slide-up focus:outline-none"
          >
            <DialogPrimitive.Title className="mb-3 text-base font-semibold text-main">
              Keyboard shortcuts
            </DialogPrimitive.Title>
            <ul className="space-y-2">
              {KEYBOARD_SHORTCUTS.map((s) => (
                <li key={s.description} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{s.description}</span>
                  <span className="flex gap-1">
                    {s.keys.map((k) => (
                      <kbd
                        key={k}
                        className="min-w-6 rounded border border-border bg-muted px-1.5 py-0.5 text-center text-[11px] font-medium text-main"
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
