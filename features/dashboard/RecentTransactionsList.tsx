"use client";

import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api/errors";
import React, { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { formatCurrency, SupportedCurrency } from "@/lib/currency/currencies";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconRenderer } from "@/components/shared/IconRenderer";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Edit2, Trash2, ArrowUpRight, ArrowDownRight, ArrowRight } from "lucide-react";
import { apiClient } from "@/lib/api/client";

interface TransactionItem {
  id: string;
  title: string;
  amount: number;
  currency: SupportedCurrency | string;
  type: "income" | "expense";
  category: {
    id: string;
    name: string;
    icon: string;
    color: string;
  };
  date: string;
  paymentMethod: string;
  notes?: string;
}

interface RecentTransactionsListProps {
  transactions: TransactionItem[];
  preferredCurrency: SupportedCurrency | string;
  onEdit: (transaction: TransactionItem) => void;
  onRefresh: () => void;
}

export function RecentTransactionsList({
  transactions,
  preferredCurrency,
  onEdit,
  onRefresh,
}: RecentTransactionsListProps) {
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/transactions/${deleteTargetId}`);
      setDeleteTargetId(null);
      toast.success("Transaction deleted");
      onRefresh();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not delete the transaction."));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-card">
      <div className="flex items-center justify-between pb-4">
        <div>
          <h2 className="text-base font-semibold text-main">Recent Transactions</h2>
          <p className="text-xs text-muted-foreground">Latest financial activities</p>
        </div>
        <Link
          href="/dashboard/transactions"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary-text hover:underline"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {transactions.length === 0 ? (
        <div className="py-12 text-center text-xs text-muted-foreground">
          No transactions recorded yet. Click &quot;Add Transaction&quot; to log your first income or expense!
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-3 font-medium">Transaction</th>
                  <th className="pb-3 font-medium">Category</th>
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Payment</th>
                  <th className="pb-3 text-right font-medium">Amount</th>
                  <th className="pb-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map((t) => {
                  const isIncome = t.type === "income";
                  return (
                    <tr key={t.id} className="transition-colors hover:bg-muted/60">
                      <td className="py-3">
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
                            <span className="font-medium text-main">{t.title}</span>
                            {t.notes && (
                              <p className="text-[11px] text-muted-foreground truncate max-w-xs">{t.notes}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3">
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

                      <td className="py-3 text-muted-foreground">
                        {format(new Date(t.date), "dd MMM yyyy")}
                      </td>

                      <td className="py-3 text-muted-foreground">{t.paymentMethod || "Other"}</td>

                      <td className="py-3 text-right">
                        <span
                          className={`font-semibold ${
                            isIncome ? "text-income-text" : "text-expense-text"
                          }`}
                        >
                          {isIncome ? "+" : "-"}
                          {formatCurrency(t.amount, t.currency || preferredCurrency)}
                        </span>
                      </td>

                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary-text"
                            onClick={() => onEdit(t)}
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

          {/* Mobile List View */}
          <div className="divide-y divide-border md:hidden">
            {transactions.map((t) => {
              const isIncome = t.type === "income";
              return (
                <div key={t.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
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
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground">
                          {format(new Date(t.date), "dd MMM")}
                        </span>
                        <span className="text-[11px] text-muted-foreground">&bull;</span>
                        <span className="text-[11px] text-muted-foreground">{t.category?.name}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold ${
                        isIncome ? "text-income-text" : "text-expense-text"
                      }`}
                    >
                      {isIncome ? "+" : "-"}
                      {formatCurrency(t.amount, t.currency || preferredCurrency)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => onEdit(t)}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => setDeleteTargetId(t.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
        title="Delete Transaction"
        description="Are you sure you want to delete this transaction? This action cannot be undone."
        confirmLabel="Delete"
        isDestructive
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
