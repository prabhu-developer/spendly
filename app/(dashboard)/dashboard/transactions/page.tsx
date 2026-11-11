"use client";

import React, { useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { apiClient } from "@/lib/api/client";
import { formatCurrency, isValidCurrency } from "@/lib/currency/currencies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconRenderer } from "@/components/shared/IconRenderer";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import dynamic from "next/dynamic";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const TransactionDialog = dynamic(
  () =>
    import("@/components/transactions/TransactionDialog").then(
      (module) => module.TransactionDialog
    ),
  { ssr: false }
);

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();

  // Filters & State
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);
  const limit = 10;

  // Modals
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [viewingTransaction, setViewingTransaction] = useState<any | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // User
  const { data: userData } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const res = await apiClient.get("/auth/me");
      return res.data.user;
    },
  });

  // Categories
  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await apiClient.get("/categories");
      return res.data.categories;
    },
  });

  // Debounce search so typing doesn't fire a request per keystroke
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  // Fetch transactions with query params (server-side filtering, sorting, pagination)
  const { data: transactionsData, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: [
      "transactions",
      { search: debouncedSearch, typeFilter, categoryFilter, startDate, endDate, sortBy, sortOrder, page },
    ],
    staleTime: 0,
    // Keep the current page visible while the next one loads (no flash of empty table)
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (categoryFilter !== "all") params.set("categoryId", categoryFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      params.set("page", page.toString());
      params.set("limit", limit.toString());

      // `signal` cancels superseded requests when filters change
      const res = await apiClient.get(`/transactions?${params.toString()}`, { signal });
      return res.data;
    },
  });

  const preferredCurrency = isValidCurrency(userData?.preferredCurrency)
    ? userData.preferredCurrency
    : null;
  const editingCurrency = preferredCurrency || (
    isValidCurrency(editingTransaction?.currency) ? editingTransaction.currency : null
  );
  const categories = categoriesData || [];
  const transactions = transactionsData?.transactions || [];
  const pagination = transactionsData?.pagination || { page: 1, totalPages: 1, total: 0 };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/transactions/${deleteTargetId}`);
      setDeleteTargetId(null);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRefresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["reports"] });
    queryClient.invalidateQueries({ queryKey: ["budgets"] });
  };

  return (
    <div className="space-y-6">
      {/* Header and Add Button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-main">Transactions</h2>
          <p className="text-xs text-muted-foreground">
            Manage, filter, and track all your income and expenses.
          </p>
        </div>

        <Button
          onClick={() => router.push("/dashboard/transactions/new")}
          className="gap-1.5 bg-primary hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" />
          Add Transaction
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-xl border border-border bg-white p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* Type Filter */}
          <Select
            value={typeFilter}
            onValueChange={(val) => {
              setTypeFilter(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="expense">Expense Only</SelectItem>
              <SelectItem value="income">Income Only</SelectItem>
            </SelectContent>
          </Select>

          {/* Category Filter */}
          <Select
            value={categoryFilter}
            onValueChange={(val) => {
              setCategoryFilter(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat: any) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name} ({cat.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date Range Start */}
          <Input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            className="h-9 text-xs"
            placeholder="From Date"
          />

          {/* Date Range End */}
          <Input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
            className="h-9 text-xs"
            placeholder="To Date"
          />
        </div>

        {/* Sorting options */}
        <div className="flex flex-wrap items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Sort by:</span>
            <button
              onClick={() => {
                if (sortBy === "date") {
                  setSortOrder(sortOrder === "desc" ? "asc" : "desc");
                } else {
                  setSortBy("date");
                  setSortOrder("desc");
                }
              }}
              className={`flex items-center gap-1 rounded px-2 py-1 font-medium transition-colors ${
                sortBy === "date" ? "bg-muted text-primary-text" : "hover:text-main"
              }`}
            >
              Date {sortBy === "date" && (sortOrder === "desc" ? "↓" : "↑")}
            </button>
            <button
              onClick={() => {
                if (sortBy === "amount") {
                  setSortOrder(sortOrder === "desc" ? "asc" : "desc");
                } else {
                  setSortBy("amount");
                  setSortOrder("desc");
                }
              }}
              className={`flex items-center gap-1 rounded px-2 py-1 font-medium transition-colors ${
                sortBy === "amount" ? "bg-muted text-primary-text" : "hover:text-main"
              }`}
            >
              Amount {sortBy === "amount" && (sortOrder === "desc" ? "↓" : "↑")}
            </button>
          </div>

          {(search || typeFilter !== "all" || categoryFilter !== "all" || startDate || endDate) && (
            <button
              onClick={() => {
                setSearch("");
                setTypeFilter("all");
                setCategoryFilter("all");
                setStartDate("");
                setEndDate("");
                setPage(1);
              }}
              className="text-expense-text hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Transaction List / Table */}
      <div
        className={`rounded-xl border border-border bg-white shadow-sm overflow-hidden transition-opacity ${
          isFetching && !isLoading ? "opacity-70" : ""
        }`}
        aria-busy={isFetching}
      >
        {isLoading ? (
          <div className="divide-y divide-border" aria-label="Loading transactions">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
                  <div className="h-2.5 w-1/5 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : isError && !transactionsData ? (
          <div role="alert" className="flex flex-col items-center gap-3 py-12 text-xs text-muted-foreground">
            Transactions could not be loaded.
            <Button variant="outline" size="sm" onClick={() => void refetch()} className="border-border">
              Try again
            </Button>
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState
            title="No transactions found"
            description="Try adjusting your search filters or click below to record a new transaction."
            actionLabel="Add Transaction"
            onAction={() => router.push("/dashboard/transactions/new")}
          />
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/60 text-muted-foreground">
                    <th className="py-3 px-4 font-medium">Transaction</th>
                    <th className="py-3 px-4 font-medium">Category</th>
                    <th className="py-3 px-4 font-medium">Date</th>
                    <th className="py-3 px-4 font-medium">Method</th>
                    <th className="py-3 px-4 text-right font-medium">Amount</th>
                    <th className="py-3 px-4 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transactions.map((t: any) => {
                    const isIncome = t.type === "income";
                    return (
                      <tr key={t.id} className="transition-colors hover:bg-muted/50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                isIncome ? "bg-income-light text-income-text" : "bg-expense-light text-expense-text"
                              }`}
                            >
                              {isIncome ? (
                                <ArrowUpRight className="h-4 w-4" />
                              ) : (
                                <ArrowDownRight className="h-4 w-4" />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-main">{t.title}</p>
                              {t.notes && (
                                <p className="text-[11px] text-muted-foreground truncate max-w-xs">{t.notes}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <Badge
                            variant="secondary"
                            className="gap-1 font-normal"
                            style={{
                              backgroundColor: `${t.category?.color || "#2878E5"}15`,
                              color: t.category?.color || "#2878E5",
                            }}
                          >
                            <IconRenderer name={t.category?.icon || "Tag"} className="h-3 w-3" />
                            {t.category?.name || "General"}
                          </Badge>
                        </td>

                        <td className="py-3 px-4 text-muted-foreground">
                          {format(new Date(t.date), "dd MMM yyyy")}
                        </td>

                        <td className="py-3 px-4 text-muted-foreground">{t.paymentMethod}</td>

                        <td className="py-3 px-4 text-right">
                          <span
                            className={`font-semibold ${
                              isIncome ? "text-income-text" : "text-expense-text"
                            }`}
                          >
                            {isIncome ? "+" : "-"}
                            {formatCurrency(t.amount, t.currency)}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-primary-text"
                              onClick={() => setViewingTransaction(t)}
                              title="Details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-primary-text"
                              onClick={() => setEditingTransaction(t)}
                              title="Edit"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-expense-text"
                              onClick={() => setDeleteTargetId(t.id)}
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards List */}
            <div className="divide-y divide-border p-4 md:hidden">
              {transactions.map((t: any) => {
                const isIncome = t.type === "income";
                return (
                  <div key={t.id} className="py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            isIncome ? "bg-income-light text-income-text" : "bg-expense-light text-expense-text"
                          }`}
                        >
                          {isIncome ? (
                            <ArrowUpRight className="h-4 w-4" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-main">{t.title}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {format(new Date(t.date), "dd MMM yyyy")} &bull; {t.category?.name}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`text-xs font-semibold ${
                          isIncome ? "text-income-text" : "text-expense-text"
                        }`}
                      >
                        {isIncome ? "+" : "-"}
                        {formatCurrency(t.amount, t.currency)}
                      </span>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => setViewingTransaction(t)}
                      >
                        <Eye className="h-3 w-3 mr-1" /> View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => setEditingTransaction(t)}
                      >
                        <Edit2 className="h-3 w-3 mr-1" /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-expense-text"
                        onClick={() => setDeleteTargetId(t.id)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" /> Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination controls */}
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
              <div>
                Showing page <span className="font-semibold text-main">{pagination.page}</span>{" "}
                of <span className="font-semibold text-main">{pagination.totalPages}</span> (
                {pagination.total} total)
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 gap-1 border-border px-2 text-xs"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-8 gap-1 border-border px-2 text-xs"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Edit Dialog */}
      {editingTransaction && editingCurrency && (
        <TransactionDialog
          open={Boolean(editingTransaction)}
          onOpenChange={(open) => !open && setEditingTransaction(null)}
          categories={categories}
          defaultCurrency={editingCurrency}
          initialData={editingTransaction}
          onSuccess={handleRefresh}
        />
      )}

      {/* View Details Dialog */}
      {viewingTransaction && (
        <Dialog open={Boolean(viewingTransaction)} onOpenChange={() => setViewingTransaction(null)}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Transaction Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-3 text-xs">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Title:</span>
                <span className="font-semibold text-main">{viewingTransaction.title}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Type:</span>
                <span className="font-semibold capitalize text-main">{viewingTransaction.type}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Amount:</span>
                <span
                  className={`font-semibold ${
                    viewingTransaction.type === "income" ? "text-income-text" : "text-expense-text"
                  }`}
                >
                  {formatCurrency(viewingTransaction.amount, viewingTransaction.currency)}
                </span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Category:</span>
                <span className="font-semibold text-main">{viewingTransaction.category?.name}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Date:</span>
                <span className="font-semibold text-main">
                  {format(new Date(viewingTransaction.date), "dd MMMM yyyy")}
                </span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Payment Method:</span>
                <span className="font-semibold text-main">{viewingTransaction.paymentMethod}</span>
              </div>
              {viewingTransaction.notes && (
                <div className="flex flex-col gap-1 border-b border-border pb-2">
                  <span className="text-muted-foreground">Notes:</span>
                  <span className="text-main">{viewingTransaction.notes}</span>
                </div>
              )}
              {viewingTransaction.exchangeRateSnapshot && (
                <div className="rounded-lg bg-muted p-2.5 text-[11px] text-muted-foreground">
                  Rate Snapshot: 1 USD = {viewingTransaction.exchangeRateSnapshot.rateToUSD}{" "}
                  {viewingTransaction.currency} (Captured on{" "}
                  {format(new Date(viewingTransaction.exchangeRateSnapshot.rateDate), "dd MMM yyyy")})
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
        title="Delete Transaction"
        description="Are you sure you want to delete this transaction record? This operation cannot be reversed."
        confirmLabel="Delete"
        isDestructive
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
