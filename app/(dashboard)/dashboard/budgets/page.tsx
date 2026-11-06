"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { formatCurrency, SupportedCurrency, CURRENCY_LIST } from "@/lib/currency/currencies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { IconRenderer } from "@/components/shared/IconRenderer";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  PiggyBank,
} from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function BudgetsPage() {
  const queryClient = useQueryClient();
  const currentDate = new Date();

  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());

  // Modal states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<any | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form states
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<SupportedCurrency>("USD");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Fetch user info
  const { data: userData } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const res = await apiClient.get("/auth/me");
      return res.data.user;
    },
  });

  // 2. Fetch expense categories
  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await apiClient.get("/categories");
      return res.data.categories.filter((c: any) => c.type === "expense");
    },
  });

  // 3. Fetch budgets
  const { data: budgetsData, isLoading, refetch } = useQuery({
    queryKey: ["budgets", { month: selectedMonth, year: selectedYear }],
    queryFn: async () => {
      const res = await apiClient.get(`/budgets?month=${selectedMonth}&year=${selectedYear}`);
      return res.data;
    },
  });

  const preferredCurrency = userData?.preferredCurrency || "USD";
  const expenseCategories = categoriesData || [];
  const budgets = budgetsData?.budgets || [];
  const summary = budgetsData?.summary || {
    totalBudget: 0,
    totalSpent: 0,
    totalRemaining: 0,
    overallPercentage: 0,
  };

  const openCreateDialog = () => {
    setEditingBudget(null);
    setCategoryId(expenseCategories[0]?.id || "");
    setAmount("");
    setCurrency(preferredCurrency as SupportedCurrency);
    setFormError("");
    setDialogOpen(true);
  };

  const openEditDialog = (budget: any) => {
    setEditingBudget(budget);
    setCategoryId(budget.category.id);
    setAmount(budget.originalAmount.toString());
    setCurrency(budget.originalCurrency || preferredCurrency);
    setFormError("");
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setFormError("Please enter a valid positive budget amount");
      return;
    }
    if (!categoryId) {
      setFormError("Please select a category");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingBudget) {
        await apiClient.put(`/budgets/${editingBudget.id}`, {
          categoryId,
          amount: parsedAmount,
          currency,
          month: selectedMonth,
          year: selectedYear,
        });
      } else {
        await apiClient.post("/budgets", {
          categoryId,
          amount: parsedAmount,
          currency,
          month: selectedMonth,
          year: selectedYear,
        });
      }
      setDialogOpen(false);
      refetch();
    } catch (err: any) {
      setFormError(err.response?.data?.error || "Failed to save budget");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/budgets/${deleteTargetId}`);
      setDeleteTargetId(null);
      refetch();
    } catch (err) {
      console.error("Delete budget failed:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#202735]">Budgets</h2>
          <p className="text-xs text-[#8992A3]">
            Set category limits, monitor spending progress, and prevent budget overruns.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Month selector */}
          <Select
            value={selectedMonth.toString()}
            onValueChange={(val) => setSelectedMonth(parseInt(val, 10))}
          >
            <SelectTrigger className="h-9 w-36 text-xs">
              <Calendar className="mr-1.5 h-3.5 w-3.5 text-[#2878E5]" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, idx) => (
                <SelectItem key={idx} value={(idx + 1).toString()}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Year selector */}
          <Select
            value={selectedYear.toString()}
            onValueChange={(val) => setSelectedYear(parseInt(val, 10))}
          >
            <SelectTrigger className="h-9 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={openCreateDialog}
            className="gap-1.5 bg-[#2878E5] hover:bg-[#1F65C2]"
          >
            <Plus className="h-4 w-4" />
            Set Budget
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border border-[#E8EDF4]">
          <CardContent className="p-5">
            <span className="text-xs font-medium text-[#8992A3]">Total Monthly Budget</span>
            <div className="mt-2 text-xl font-bold text-[#202735]">
              {formatCurrency(summary.totalBudget, preferredCurrency)}
            </div>
            <p className="mt-1 text-[11px] text-[#8992A3]">
              Allocated across {budgets.length} category targets
            </p>
          </CardContent>
        </Card>

        <Card className="border border-[#E8EDF4]">
          <CardContent className="p-5">
            <span className="text-xs font-medium text-[#8992A3]">Total Spent</span>
            <div className="mt-2 text-xl font-bold text-[#F07862]">
              {formatCurrency(summary.totalSpent, preferredCurrency)}
            </div>
            <p className="mt-1 text-[11px] text-[#8992A3]">
              {summary.overallPercentage}% of monthly limit consumed
            </p>
          </CardContent>
        </Card>

        <Card className="border border-[#E8EDF4]">
          <CardContent className="p-5">
            <span className="text-xs font-medium text-[#8992A3]">Remaining Safe Margin</span>
            <div className="mt-2 text-xl font-bold text-[#269B72]">
              {formatCurrency(summary.totalRemaining, preferredCurrency)}
            </div>
            <p className="mt-1 text-[11px] text-[#8992A3]">
              Available before hitting monthly ceiling
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Budgets Grid */}
      {isLoading ? (
        <div className="py-16 text-center text-xs text-[#8992A3]">Loading budgets...</div>
      ) : budgets.length === 0 ? (
        <EmptyState
          icon={<PiggyBank className="h-6 w-6 text-[#2878E5]" />}
          title={`No budgets set for ${MONTHS[selectedMonth - 1]} ${selectedYear}`}
          description="Create spending limits for key expense categories like Food, Transport, or Bills to monitor expenses."
          actionLabel="Set Category Budget"
          onAction={openCreateDialog}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {budgets.map((b: any) => {
            const isExceeded = b.isExceeded;
            const isWarning = !isExceeded && b.percentage >= 80;

            let progressColor = "bg-[#2878E5]";
            if (isExceeded) progressColor = "bg-[#F07862]";
            else if (isWarning) progressColor = "bg-[#E9B949]";

            return (
              <Card
                key={b.id}
                className={`border transition-all duration-200 hover:shadow-md ${
                  isExceeded ? "border-[#F07862]/40 bg-[#FDF1EE]/20" : "border-[#E8EDF4]"
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-lg"
                        style={{
                          backgroundColor: `${b.category?.color || "#2878E5"}15`,
                          color: b.category?.color || "#2878E5",
                        }}
                      >
                        <IconRenderer name={b.category?.icon || "Tag"} className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold">{b.category?.name}</CardTitle>
                        <span className="text-[11px] text-[#8992A3]">
                          Limit: {formatCurrency(b.amount, preferredCurrency)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-[#8992A3] hover:text-[#2878E5]"
                        onClick={() => openEditDialog(b)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-[#8992A3] hover:text-[#F07862]"
                        onClick={() => setDeleteTargetId(b.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-0">
                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#8992A3]">Spent: {formatCurrency(b.spent, preferredCurrency)}</span>
                      <span className="font-semibold text-[#202735]">{b.percentage}%</span>
                    </div>

                    <Progress
                      value={Math.min(100, b.percentage)}
                      indicatorClassName={progressColor}
                    />
                  </div>

                  {/* Status Indicator */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    {isExceeded ? (
                      <span className="inline-flex items-center gap-1 font-medium text-[#F07862]">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Exceeded by {formatCurrency(b.spent - b.amount, preferredCurrency)}
                      </span>
                    ) : isWarning ? (
                      <span className="inline-flex items-center gap-1 font-medium text-[#E9B949]">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Near limit ({formatCurrency(b.remaining, preferredCurrency)} left)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[#269B72]">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {formatCurrency(b.remaining, preferredCurrency)} remaining
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Set/Edit Budget Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>
              {editingBudget ? "Edit Budget Limit" : `Set Budget for ${MONTHS[selectedMonth - 1]}`}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {formError && (
              <div className="rounded-lg bg-[#FDF1EE] p-3 text-xs text-[#F07862]">
                {formError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="amount">Monthly Spending Limit</Label>
                <Input
                  id="amount"
                  type="number"
                  step="any"
                  min="1"
                  placeholder="e.g. 500"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={currency}
                  onValueChange={(val) => setCurrency(val as SupportedCurrency)}
                >
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_LIST.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} ({c.symbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg bg-[#F3F6FC] p-3 text-xs text-[#8992A3]">
              Target Period:{" "}
              <span className="font-semibold text-[#202735]">
                {MONTHS[selectedMonth - 1]} {selectedYear}
              </span>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#2878E5] hover:bg-[#1F65C2]"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : editingBudget ? "Update Budget" : "Create Budget"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
        title="Remove Budget Target"
        description="Are you sure you want to remove this category budget target? Your transaction records will remain unaffected."
        confirmLabel="Remove"
        isDestructive
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
