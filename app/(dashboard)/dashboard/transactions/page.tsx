"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { formatCurrency } from "@/lib/currency/currencies";
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
import { TransactionDialog } from "@/components/transactions/TransactionDialog";
import {
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  Edit2,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function TransactionsPage() {
  const queryClient = useQueryClient();

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
  const [isAddOpen, setIsAddOpen] = useState(false);
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

  // Fetch transactions with query params
  const { data: transactionsData, isLoading, refetch } = useQuery({
    queryKey: [
      "transactions",
      { search, typeFilter, categoryFilter, startDate, endDate, sortBy, sortOrder, page },
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (categoryFilter !== "all") params.set("categoryId", categoryFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      params.set("page", page.toString());
      params.set("limit", limit.toString());

      const res = await apiClient.get(`/transactions?${params.toString()}`);
      return res.data;
    },
  });

  const preferredCurrency = userData?.preferredCurrency || "USD";
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
          <h2 className="text-xl font-bold tracking-tight text-[#202735]">Transactions</h2>
          <p className="text-xs text-[#8992A3]">
            Manage, filter, and track all your income and expenses.
          </p>
        </div>

        <Button
          onClick={() => setIsAddOpen(true)}
          className="gap-1.5 bg-[#2878E5] hover:bg-[#1F65C2]"
        >
          <Plus className="h-4 w-4" />
          Add Transaction
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-xl border border-[#E8EDF4] bg-white p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#8992A3]" />
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
        <div className="flex flex-wrap items-center justify-between border-t border-[#E8EDF4] pt-3 text-xs text-[#8992A3]">
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
                sortBy === "date" ? "bg-[#F3F6FC] text-[#2878E5]" : "hover:text-[#202735]"
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
                sortBy === "amount" ? "bg-[#F3F6FC] text-[#2878E5]" : "hover:text-[#202735]"
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
              className="text-[#F07862] hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Transaction List / Table */}
      <div className="rounded-xl border border-[#E8EDF4] bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-[#8992A3]">Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <EmptyState
            title="No transactions found"
            description="Try adjusting your search filters or click below to record a new transaction."
            actionLabel="Add Transaction"
            onAction={() => setIsAddOpen(true)}
          />
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E8EDF4] bg-[#F3F6FC]/60 text-[#8992A3]">
                    <th className="py-3 px-4 font-medium">Transaction</th>
                    <th className="py-3 px-4 font-medium">Category</th>
                    <th className="py-3 px-4 font-medium">Date</th>
                    <th className="py-3 px-4 font-medium">Method</th>
                    <th className="py-3 px-4 text-right font-medium">Amount</th>
                    <th className="py-3 px-4 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8EDF4]">
                  {transactions.map((t: any) => {
                    const isIncome = t.type === "income";
                    return (
                      <tr key={t.id} className="transition-colors hover:bg-[#F3F6FC]/50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                isIncome ? "bg-[#EAF6F1] text-[#269B72]" : "bg-[#FDF1EE] text-[#F07862]"
                              }`}
                            >
                              {isIncome ? (
                                <ArrowUpRight className="h-4 w-4" />
                              ) : (
                                <ArrowDownRight className="h-4 w-4" />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-[#202735]">{t.title}</p>
                              {t.notes && (
                                <p className="text-[11px] text-[#8992A3] truncate max-w-xs">{t.notes}</p>
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

                        <td className="py-3 px-4 text-[#8992A3]">
                          {format(new Date(t.date), "dd MMM yyyy")}
                        </td>

                        <td className="py-3 px-4 text-[#8992A3]">{t.paymentMethod}</td>

                        <td className="py-3 px-4 text-right">
                          <span
                            className={`font-semibold ${
                              isIncome ? "text-[#269B72]" : "text-[#F07862]"
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
                              className="h-7 w-7 text-[#8992A3] hover:text-[#2878E5]"
                              onClick={() => setViewingTransaction(t)}
                              title="Details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-[#8992A3] hover:text-[#2878E5]"
                              onClick={() => setEditingTransaction(t)}
                              title="Edit"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-[#8992A3] hover:text-[#F07862]"
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
            <div className="divide-y divide-[#E8EDF4] p-4 md:hidden">
              {transactions.map((t: any) => {
                const isIncome = t.type === "income";
                return (
                  <div key={t.id} className="py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            isIncome ? "bg-[#EAF6F1] text-[#269B72]" : "bg-[#FDF1EE] text-[#F07862]"
                          }`}
                        >
                          {isIncome ? (
                            <ArrowUpRight className="h-4 w-4" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-[#202735]">{t.title}</p>
                          <p className="text-[11px] text-[#8992A3]">
                            {format(new Date(t.date), "dd MMM yyyy")} &bull; {t.category?.name}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`text-xs font-semibold ${
                          isIncome ? "text-[#269B72]" : "text-[#F07862]"
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
                        className="h-7 text-xs text-[#8992A3]"
                        onClick={() => setViewingTransaction(t)}
                      >
                        <Eye className="h-3 w-3 mr-1" /> View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-[#8992A3]"
                        onClick={() => setEditingTransaction(t)}
                      >
                        <Edit2 className="h-3 w-3 mr-1" /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-[#F07862]"
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
            <div className="flex items-center justify-between border-t border-[#E8EDF4] px-4 py-3 text-xs text-[#8992A3]">
              <div>
                Showing page <span className="font-semibold text-[#202735]">{pagination.page}</span>{" "}
                of <span className="font-semibold text-[#202735]">{pagination.totalPages}</span> (
                {pagination.total} total)
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 gap-1 border-[#E8EDF4] px-2 text-xs"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-8 gap-1 border-[#E8EDF4] px-2 text-xs"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add Dialog */}
      <TransactionDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        categories={categories}
        defaultCurrency={preferredCurrency}
        onSuccess={handleRefresh}
      />

      {/* Edit Dialog */}
      {editingTransaction && (
        <TransactionDialog
          open={Boolean(editingTransaction)}
          onOpenChange={(open) => !open && setEditingTransaction(null)}
          categories={categories}
          defaultCurrency={preferredCurrency}
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
              <div className="flex justify-between border-b border-[#E8EDF4] pb-2">
                <span className="text-[#8992A3]">Title:</span>
                <span className="font-semibold text-[#202735]">{viewingTransaction.title}</span>
              </div>
              <div className="flex justify-between border-b border-[#E8EDF4] pb-2">
                <span className="text-[#8992A3]">Type:</span>
                <span className="font-semibold capitalize text-[#202735]">{viewingTransaction.type}</span>
              </div>
              <div className="flex justify-between border-b border-[#E8EDF4] pb-2">
                <span className="text-[#8992A3]">Amount:</span>
                <span
                  className={`font-semibold ${
                    viewingTransaction.type === "income" ? "text-[#269B72]" : "text-[#F07862]"
                  }`}
                >
                  {formatCurrency(viewingTransaction.amount, viewingTransaction.currency)}
                </span>
              </div>
              <div className="flex justify-between border-b border-[#E8EDF4] pb-2">
                <span className="text-[#8992A3]">Category:</span>
                <span className="font-semibold text-[#202735]">{viewingTransaction.category?.name}</span>
              </div>
              <div className="flex justify-between border-b border-[#E8EDF4] pb-2">
                <span className="text-[#8992A3]">Date:</span>
                <span className="font-semibold text-[#202735]">
                  {format(new Date(viewingTransaction.date), "dd MMMM yyyy")}
                </span>
              </div>
              <div className="flex justify-between border-b border-[#E8EDF4] pb-2">
                <span className="text-[#8992A3]">Payment Method:</span>
                <span className="font-semibold text-[#202735]">{viewingTransaction.paymentMethod}</span>
              </div>
              {viewingTransaction.notes && (
                <div className="flex flex-col gap-1 border-b border-[#E8EDF4] pb-2">
                  <span className="text-[#8992A3]">Notes:</span>
                  <span className="text-[#202735]">{viewingTransaction.notes}</span>
                </div>
              )}
              {viewingTransaction.exchangeRateSnapshot && (
                <div className="rounded-lg bg-[#F3F6FC] p-2.5 text-[11px] text-[#8992A3]">
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
