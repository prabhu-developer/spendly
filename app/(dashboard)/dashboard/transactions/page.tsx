"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnSizingState, RowSelectionState, VisibilityState } from "@tanstack/react-table";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Edit2,
  Eye,
  FilterX,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import {
  invalidateFinancialData,
  useAccounts,
  useCategories,
  useCurrentUser,
} from "@/lib/api/queries";
import { formatCurrency, isValidCurrency } from "@/lib/currency/currencies";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { downloadCsv, toCsv } from "@/lib/reports/csv";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { OfflineDraftsPanel } from "@/components/offline/OfflineDraftsPanel";
import { COLUMN_LABELS, TransactionsTable } from "@/features/transactions/TransactionsTable";
import {
  PAGE_SIZES,
  toSearchParams,
  useTransactionsUrlState,
  type Filters,
  type SortBy,
} from "@/features/transactions/useTransactionsUrlState";
import { useLocalPreference } from "@/lib/hooks/useLocalPreference";
import type { TransactionRow, TransactionsResponse } from "@/features/transactions/types";

const TransactionDialog = dynamic(
  () => import("@/components/transactions/TransactionDialog").then((m) => m.TransactionDialog),
  { ssr: false }
);

const HIDEABLE_COLUMNS = ["category", "account", "date", "paymentMethod"] as const;

interface SavedView {
  id: string;
  name: string;
  query: string;
}

export default function TransactionsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { state, update, setFilter, activeFilterCount } = useTransactionsUrlState();
  const { filters, sortBy, sortOrder, page, limit } = state;

  const { data: user } = useCurrentUser();
  const { data: categories = [] } = useCategories();
  const { data: sheet } = useAccounts();
  const accounts = sheet?.accounts ?? [];
  const userId: string | undefined = user?.id ?? user?.userId;

  // Search box is local state, debounced into the URL
  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300);
  useEffect(() => {
    if ((filters.search ?? "") !== debouncedSearch) setFilter("search", debouncedSearch || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);
  useEffect(() => {
    // Keep input in sync when URL changes externally (drill-down, saved view, back button)
    setSearchInput((current) => (current.trim() === (filters.search ?? "") ? current : filters.search ?? ""));
  }, [filters.search]);

  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(filters.minAmount || filters.maxAmount || filters.accountId)
  );

  // Per-device table preferences
  const prefKey = userId ? `spendly:tx-table:${userId}` : null;
  const [columnVisibility, setColumnVisibility] = useLocalPreference<VisibilityState>(
    prefKey && `${prefKey}:columns`,
    {}
  );
  const [columnSizing, setColumnSizing] = useLocalPreference<ColumnSizingState>(prefKey && `${prefKey}:sizes`, {});
  const [savedViews, setSavedViews] = useLocalPreference<SavedView[]>(prefKey && `${prefKey}:views`, []);

  const apiParams = useMemo(() => toSearchParams({ ...state }).toString(), [state]);
  const { data, isLoading, isFetching, isError, refetch } = useQuery<TransactionsResponse>({
    queryKey: ["transactions", apiParams, limit],
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams(apiParams);
      params.set("limit", String(limit));
      params.set("page", String(page));
      return (await apiClient.get(`/transactions?${params}`, { signal })).data;
    },
  });

  const rows = useMemo(() => data?.transactions ?? [], [data]);
  const pagination = data?.pagination ?? { page: 1, totalPages: 1, total: 0, limit };

  // Selection persists across pages (keyed by id); cache selected rows for export
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [selectedCache, setSelectedCache] = useState<Record<string, TransactionRow>>({});
  useEffect(() => {
    setSelectedCache((cache) => {
      const next = { ...cache };
      for (const row of rows) if (rowSelection[row.id]) next[row.id] = row;
      for (const id of Object.keys(next)) if (!rowSelection[id]) delete next[id];
      return next;
    });
  }, [rowSelection, rows]);
  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);
  const clearSelection = () => setRowSelection({});
  // Changing filters starts a new selection to avoid acting on hidden rows
  useEffect(() => clearSelection(), [apiParams.replace(/(^|&)(page|limit|sortBy|sortOrder)=[^&]*/g, "")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dialogs
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [viewing, setViewing] = useState<TransactionRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TransactionRow | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const preferredCurrency = isValidCurrency(user?.preferredCurrency) ? user.preferredCurrency : null;
  const editingCurrency =
    preferredCurrency || (isValidCurrency(editing?.currency) ? editing!.currency : null);

  const refreshAll = useCallback(() => invalidateFinancialData(queryClient), [queryClient]);

  const onSort = useCallback(
    (column: SortBy) => {
      if (sortBy === column) update({ sortOrder: sortOrder === "desc" ? "asc" : "desc" });
      else update({ sortBy: column, sortOrder: column === "title" ? "asc" : "desc" });
    },
    [sortBy, sortOrder, update]
  );
  const onView = useCallback((r: TransactionRow) => setViewing(r), []);
  const onEdit = useCallback((r: TransactionRow) => setEditing(r), []);
  const onDelete = useCallback((r: TransactionRow) => setDeleteTarget(r), []);

  const deleteOne = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await apiClient.delete(`/transactions/${deleteTarget.id}`);
      toast.success("Transaction deleted");
      setRowSelection((s) => {
        const { [deleteTarget.id]: _removed, ...rest } = s;
        return rest;
      });
      setDeleteTarget(null);
      await refreshAll();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not delete the transaction."));
    } finally {
      setBusy(false);
    }
  };

  const runBulk = async (
    body: { action: "delete" } | { action: "categorize"; categoryId: string } | { action: "assignAccount"; accountId: string | null },
    success: (affected: number, skipped?: number) => string
  ) => {
    setBusy(true);
    try {
      const res = await apiClient.post("/transactions/bulk", { ...body, ids: selectedIds });
      toast.success(success(res.data.affected, res.data.skipped));
      clearSelection();
      setBulkDeleteOpen(false);
      await refreshAll();
    } catch (error) {
      toast.error(getErrorMessage(error, "Bulk update failed."));
    } finally {
      setBusy(false);
    }
  };

  const exportSelected = () => {
    const selected = selectedIds.map((id) => selectedCache[id]).filter(Boolean);
    const csv = toCsv(
      selected.map((t) => ({
        date: format(new Date(t.date), "yyyy-MM-dd"),
        title: t.title,
        type: t.type,
        amount: t.amount,
        signed: t.type === "expense" ? -t.amount : t.amount,
        currency: t.currency,
        category: t.category.name,
        account: t.account?.name ?? "",
        method: t.paymentMethod,
        notes: t.notes,
      })),
      [
        { key: "date", header: "Date" },
        { key: "title", header: "Title" },
        { key: "type", header: "Type" },
        { key: "amount", header: "Amount" },
        { key: "signed", header: "Signed amount" },
        { key: "currency", header: "Currency" },
        { key: "category", header: "Category" },
        { key: "account", header: "Account" },
        { key: "method", header: "Payment method" },
        { key: "notes", header: "Notes" },
      ]
    );
    downloadCsv(`spendly-selected-${format(new Date(), "yyyy-MM-dd")}.csv`, csv);
    toast.success(`Exported ${selected.length} transaction${selected.length === 1 ? "" : "s"}`);
  };

  const exportFiltered = () => {
    const params = new URLSearchParams(apiParams);
    ["page", "limit", "sortBy", "sortOrder"].forEach((k) => params.delete(k));
    // Server streams CSV (up to 50k rows) as a file download
    window.location.href = `/api/transactions/export?${params}`;
  };

  const saveCurrentView = () => {
    const name = window.prompt("Name this view", "My view")?.trim();
    if (!name) return;
    const query = toSearchParams({ ...state, page: 1 }).toString();
    setSavedViews((views) => [...views.filter((v) => v.name !== name), { id: crypto.randomUUID(), name, query }].slice(-12));
    toast.success(`Saved view “${name}”`);
  };

  const clearFilters = () => {
    setSearchInput("");
    update({ filters: {} });
  };

  const typeCategories = categories.filter((c) => !filters.type || c.type === filters.type);
  const totalLabel = `${pagination.total.toLocaleString()} transaction${pagination.total === 1 ? "" : "s"}`;
  const firstRow = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const lastRow = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Transactions"
        description="Search, filter and manage every income and expense."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem onClick={exportFiltered} className="cursor-pointer flex-col items-start gap-0">
                  <span className="text-sm">Export {activeFilterCount ? "filtered" : "all"} (CSV)</span>
                  <span className="text-[11px] text-muted-foreground">Opens in Excel, Numbers and Sheets</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!selectedIds.length}
                  onClick={exportSelected}
                  className="cursor-pointer"
                >
                  Export selected ({selectedIds.length})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" onClick={() => router.push("/dashboard/transactions/new")}>
              <Plus className="h-4 w-4" />
              Add transaction
            </Button>
          </>
        }
      />

      {userId && <OfflineDraftsPanel userId={userId} />}

      {/* Filters */}
      <section aria-label="Filters" className="space-y-3 rounded-xl border border-border bg-white p-3 shadow-card sm:p-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-page-search
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by title…  ( / )"
              aria-label="Search transactions"
              className="h-9 pl-9 pr-8 text-sm"
              maxLength={100}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
            <Select value={filters.type ?? "all"} onValueChange={(v) => setFilter("type", v)}>
              <SelectTrigger className="h-9 text-xs lg:w-32" aria-label="Type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="expense">Expenses</SelectItem>
                <SelectItem value="income">Income</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.categoryId ?? "all"} onValueChange={(v) => setFilter("categoryId", v)}>
              <SelectTrigger className="h-9 text-xs lg:w-40" aria-label="Category">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {typeCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {!filters.type && <span className="text-muted-foreground"> · {c.type}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={filters.startDate ?? ""}
              max={filters.endDate}
              onChange={(e) => setFilter("startDate", e.target.value || undefined)}
              className="h-9 text-xs lg:w-36"
              aria-label="From date"
            />
            <Input
              type="date"
              value={filters.endDate ?? ""}
              min={filters.startDate}
              onChange={(e) => setFilter("endDate", e.target.value || undefined)}
              className="h-9 text-xs lg:w-36"
              aria-label="To date"
            />
          </div>
          <Button
            variant={showAdvanced ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
            className="h-9"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            More
          </Button>
        </div>

        {showAdvanced && (
          <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 sm:grid-cols-4 animate-fade-in">
            <Select value={filters.accountId ?? "all"} onValueChange={(v) => setFilter("accountId", v)}>
              <SelectTrigger className="h-9 text-xs" aria-label="Account">
                <SelectValue placeholder="All accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                <SelectItem value="unassigned">No account</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AmountInput
              label="Min amount"
              value={filters.minAmount}
              onCommit={(v) => setFilter("minAmount", v)}
            />
            <AmountInput
              label="Max amount"
              value={filters.maxAmount}
              onCommit={(v) => setFilter("maxAmount", v)}
            />
            <SavedViewsMenu
              views={savedViews}
              onApply={(v) => router.replace(`/dashboard/transactions${v.query ? `?${v.query}` : ""}`, { scroll: false })}
              onSave={saveCurrentView}
              onDelete={(id) => setSavedViews((views) => views.filter((v) => v.id !== id))}
            />
          </div>
        )}

        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <ActiveFilterChips
              filters={filters}
              categoryName={(id) => categories.find((c) => c.id === id)?.name}
              accountName={(id) => (id === "unassigned" ? "No account" : accounts.find((a) => a.id === id)?.name)}
              onRemove={(key) => {
                if (key === "search") setSearchInput("");
                setFilter(key, undefined);
              }}
            />
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-expense-text hover:bg-expense-light"
            >
              <FilterX className="h-3.5 w-3.5" />
              Clear all
            </button>
          </div>
        )}
      </section>

      {/* Bulk actions */}
      {selectedIds.length > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary-light px-3 py-2 shadow-card animate-slide-up"
        >
          <span className="text-sm font-medium text-main">
            {selectedIds.length} selected
          </span>
          <button type="button" onClick={clearSelection} className="text-xs text-primary-text hover:underline">
            Clear
          </button>
          <div className="ml-auto flex flex-wrap gap-2">
            <Select
              value=""
              onValueChange={(categoryId) =>
                void runBulk({ action: "categorize", categoryId }, (n, skipped) =>
                  `Updated ${n} transaction${n === 1 ? "" : "s"}${skipped ? ` · ${skipped} skipped (type mismatch)` : ""}`
                )
              }
              disabled={busy}
            >
              <SelectTrigger className="h-8 w-40 bg-white text-xs" aria-label="Change category for selected">
                <SelectValue placeholder="Set category…" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} · {c.type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {accounts.length > 0 && (
              <Select
                value=""
                onValueChange={(v) =>
                  void runBulk({ action: "assignAccount", accountId: v === "none" ? null : v }, (n) =>
                    `Moved ${n} transaction${n === 1 ? "" : "s"}`
                  )
                }
                disabled={busy}
              >
                <SelectTrigger className="h-8 w-40 bg-white text-xs" aria-label="Assign account for selected">
                  <SelectValue placeholder="Set account…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No account</SelectItem>
                  {accounts.filter((a) => !a.isArchived).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" className="h-8" onClick={exportSelected}>
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            <Button variant="destructive" size="sm" className="h-8" onClick={() => setBulkDeleteOpen(true)} disabled={busy}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <section
        aria-label="Transactions"
        aria-busy={isFetching}
        className="overflow-hidden rounded-xl border border-border bg-white shadow-card"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {isLoading ? "Loading…" : totalLabel}
            {isFetching && !isLoading && <span className="ml-2 text-primary-text">Updating…</span>}
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="hidden h-8 text-xs text-muted-foreground md:inline-flex">
                <Columns3 className="h-3.5 w-3.5" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs">Visible columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {HIDEABLE_COLUMNS.map((id) => (
                <DropdownMenuCheckboxItem
                  key={id}
                  checked={columnVisibility[id] !== false}
                  onCheckedChange={(checked) => setColumnVisibility((v) => ({ ...v, [id]: Boolean(checked) }))}
                  onSelect={(e) => e.preventDefault()}
                >
                  {COLUMN_LABELS[id]}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setColumnVisibility({});
                  setColumnSizing({});
                }}
                className="cursor-pointer text-xs"
              >
                Reset columns
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isLoading ? (
          <TableSkeleton />
        ) : isError && !data ? (
          <div role="alert" className="flex flex-col items-center gap-3 py-14 text-sm text-muted-foreground">
            Transactions could not be loaded.
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title={activeFilterCount ? "No matching transactions" : "No transactions yet"}
            description={
              activeFilterCount
                ? "Try widening the date range or removing a filter."
                : "Record your first income or expense to start tracking your money."
            }
            actionLabel={activeFilterCount ? "Clear filters" : "Add transaction"}
            onAction={activeFilterCount ? clearFilters : () => router.push("/dashboard/transactions/new")}
          />
        ) : (
          <div className={cn("transition-opacity", isFetching && "opacity-70")}>
            <div className="hidden md:block">
              <TransactionsTable
                rows={rows}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
                rowSelection={rowSelection}
                onRowSelectionChange={setRowSelection}
                columnVisibility={columnVisibility}
                columnSizing={columnSizing}
                onColumnSizingChange={setColumnSizing}
                onView={onView}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </div>
            <MobileList
              rows={rows}
              rowSelection={rowSelection}
              onToggle={(id) => setRowSelection((s) => ({ ...s, [id]: !s[id] }))}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>
        )}

        {rows.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="tabular-nums">
                {firstRow.toLocaleString()}–{lastRow.toLocaleString()} of {pagination.total.toLocaleString()}
              </span>
              <Select value={String(limit)} onValueChange={(v) => update({ limit: Number(v) })}>
                <SelectTrigger className="h-8 w-[88px] text-xs" aria-label="Rows per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      {s} / page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                disabled={pagination.page <= 1}
                onClick={() => update({ page: pagination.page - 1 }, { resetPage: false })}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </Button>
              <span className="px-1 tabular-nums">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => update({ page: pagination.page + 1 }, { resetPage: false })}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </section>

      {editing && editingCurrency && (
        <TransactionDialog
          open
          onOpenChange={(open) => !open && setEditing(null)}
          categories={categories}
          defaultCurrency={editingCurrency}
          initialData={editing}
          onSuccess={() => void refreshAll()}
        />
      )}

      {viewing && <DetailsDialog tx={viewing} onClose={() => setViewing(null)} />}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete transaction?"
        description={
          deleteTarget
            ? `“${deleteTarget.title}” (${formatCurrency(deleteTarget.amount, deleteTarget.currency)}) will be permanently removed. This can't be undone.`
            : ""
        }
        confirmLabel="Delete"
        isDestructive
        isLoading={busy}
        onConfirm={() => void deleteOne()}
      />
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Delete ${selectedIds.length} transaction${selectedIds.length === 1 ? "" : "s"}?`}
        description="The selected transactions will be permanently removed and your totals recalculated. This can't be undone."
        confirmLabel={`Delete ${selectedIds.length}`}
        isDestructive
        isLoading={busy}
        onConfirm={() =>
          void runBulk({ action: "delete" }, (n) => `Deleted ${n} transaction${n === 1 ? "" : "s"}`)
        }
      />
    </div>
  );
}

/* ---------- Pieces ---------- */

function AmountInput({
  label,
  value,
  onCommit,
}: {
  label: string;
  value?: string;
  onCommit: (v: string | undefined) => void;
}) {
  const [local, setLocal] = useState(value ?? "");
  useEffect(() => setLocal(value ?? ""), [value]);
  const commit = () => {
    const trimmed = local.trim();
    if (trimmed === (value ?? "")) return;
    onCommit(trimmed && Number(trimmed) >= 0 ? trimmed : undefined);
  };
  return (
    <Input
      type="number"
      inputMode="decimal"
      min="0"
      step="any"
      placeholder={label}
      aria-label={label}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      className="h-9 text-xs"
    />
  );
}

const CHIP_LABELS: Record<keyof Filters, string> = {
  search: "Search",
  type: "Type",
  categoryId: "Category",
  accountId: "Account",
  startDate: "From",
  endDate: "To",
  minAmount: "Min",
  maxAmount: "Max",
};

function ActiveFilterChips({
  filters,
  categoryName,
  accountName,
  onRemove,
}: {
  filters: Filters;
  categoryName: (id: string) => string | undefined;
  accountName: (id: string) => string | undefined;
  onRemove: (key: keyof Filters) => void;
}) {
  return (
    <>
      {(Object.keys(filters) as (keyof Filters)[]).map((key) => {
        const raw = filters[key]!;
        const display =
          key === "categoryId" ? categoryName(raw) ?? "…" : key === "accountId" ? accountName(raw) ?? "…" : raw;
        return (
          <span
            key={key}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted py-0.5 pl-2.5 pr-1 text-xs text-main"
          >
            <span className="text-muted-foreground">{CHIP_LABELS[key]}:</span>
            <span className="max-w-40 truncate font-medium capitalize">{display}</span>
            <button
              type="button"
              onClick={() => onRemove(key)}
              aria-label={`Remove ${CHIP_LABELS[key]} filter`}
              className="rounded-full p-0.5 text-muted-foreground hover:bg-border hover:text-main"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      })}
    </>
  );
}

function SavedViewsMenu({
  views,
  onApply,
  onSave,
  onDelete,
}: {
  views: SavedView[];
  onApply: (v: SavedView) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 justify-start text-xs">
          <Bookmark className="h-3.5 w-3.5" />
          Saved views{views.length ? ` (${views.length})` : ""}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {views.length === 0 && (
          <p className="px-2 py-2 text-xs text-muted-foreground">Save the current filters to reuse them later.</p>
        )}
        {views.map((v) => (
          <DropdownMenuItem key={v.id} onClick={() => onApply(v)} className="cursor-pointer justify-between gap-2">
            <span className="truncate">{v.name}</span>
            <button
              type="button"
              aria-label={`Delete view ${v.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(v.id);
              }}
              className="rounded p-0.5 text-muted-foreground hover:bg-expense-light hover:text-expense-text"
            >
              <X className="h-3 w-3" />
            </button>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSave} className="cursor-pointer text-primary-text">
          <Plus className="mr-1 h-3.5 w-3.5" /> Save current view
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TableSkeleton() {
  return (
    <div aria-label="Loading transactions" className="divide-y divide-border">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="h-4 w-4" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-1/5" />
          </div>
          <Skeleton className="hidden h-5 w-20 rounded-full md:block" />
          <Skeleton className="hidden h-3 w-20 md:block" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

function MobileList({
  rows,
  rowSelection,
  onToggle,
  onView,
  onEdit,
  onDelete,
}: {
  rows: TransactionRow[];
  rowSelection: RowSelectionState;
  onToggle: (id: string) => void;
  onView: (r: TransactionRow) => void;
  onEdit: (r: TransactionRow) => void;
  onDelete: (r: TransactionRow) => void;
}) {
  return (
    <ul className="divide-y divide-border md:hidden">
      {rows.map((t) => {
        const income = t.type === "income";
        return (
          <li key={t.id} className={cn("flex items-start gap-3 px-4 py-3", rowSelection[t.id] && "bg-primary-light/60")}>
            <input
              type="checkbox"
              aria-label={`Select ${t.title}`}
              checked={Boolean(rowSelection[t.id])}
              onChange={() => onToggle(t.id)}
              className="mt-2.5 h-4 w-4 accent-primary"
            />
            <button type="button" onClick={() => onView(t)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  income ? "bg-income-light text-income-text" : "bg-expense-light text-expense-text"
                )}
              >
                {income ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-main">{t.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {format(new Date(t.date), "dd MMM")} · {t.category.name}
                  {t.account && ` · ${t.account.name}`}
                </span>
              </span>
              <span className={cn("shrink-0 text-sm font-semibold tabular-nums", income ? "text-income-text" : "text-expense-text")}>
                {income ? "+" : "−"}
                {formatCurrency(t.amount, t.currency)}
              </span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${t.title}`} className="mt-0.5">
                  <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onView(t)} className="gap-2">
                  <Eye className="h-4 w-4" /> Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(t)} className="gap-2">
                  <Edit2 className="h-4 w-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(t)} className="gap-2 text-expense-text focus:text-expense-text">
                  <Trash2 className="h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        );
      })}
    </ul>
  );
}

function DetailsDialog({ tx, onClose }: { tx: TransactionRow; onClose: () => void }) {
  const income = tx.type === "income";
  const rows: [string, React.ReactNode][] = [
    ["Type", <span key="t" className="capitalize">{tx.type}</span>],
    ["Category", tx.category.name],
    ["Account", tx.account?.name ?? "—"],
    ["Date", format(new Date(tx.date), "dd MMMM yyyy")],
    ["Payment method", tx.paymentMethod],
  ];
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="pr-6">{tx.title}</DialogTitle>
        </DialogHeader>
        <p className={cn("text-3xl font-semibold tracking-tight tabular-nums", income ? "text-income-text" : "text-expense-text")}>
          {income ? "+" : "−"}
          {formatCurrency(tx.amount, tx.currency)}
        </p>
        <dl className="divide-y divide-border text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-2">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right font-medium text-main">{value}</dd>
            </div>
          ))}
        </dl>
        {tx.notes && <p className="rounded-lg bg-muted p-3 text-sm text-main">{tx.notes}</p>}
        {tx.exchangeRateSnapshot && (
          <p className="text-xs text-muted-foreground">
            Rate at entry: 1 USD = {tx.exchangeRateSnapshot.rateToUSD} {tx.currency} (
            {format(new Date(tx.exchangeRateSnapshot.rateDate), "dd MMM yyyy")})
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
