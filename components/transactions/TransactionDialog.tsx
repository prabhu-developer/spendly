"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/lib/api/client";
import { CURRENCY_LIST, SupportedCurrency } from "@/lib/currency/currencies";
import { TransactionInput, transactionSchema } from "@/lib/validations/transaction";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

export interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Array<{ id: string; name: string; type: "income" | "expense" }>;
  defaultCurrency?: SupportedCurrency;
  initialData?: any | null;
  onSuccess: () => void;
}

export function TransactionDialog({
  open,
  onOpenChange,
  categories,
  defaultCurrency = "USD",
  initialData,
  onSuccess,
}: TransactionDialogProps) {
  const isEditing = Boolean(initialData);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TransactionInput>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      title: "",
      amount: "" as any,
      currency: defaultCurrency,
      type: "expense",
      categoryId: "",
      date: format(new Date(), "yyyy-MM-dd"),
      paymentMethod: "Other",
      notes: "",
    },
  });

  const selectedType = watch("type");
  const selectedCurrency = watch("currency");
  const selectedCategory = watch("categoryId");
  const selectedPaymentMethod = watch("paymentMethod");

  // Filter categories matching current transaction type
  const availableCategories = categories.filter((c) => c.type === selectedType);

  useEffect(() => {
    if (initialData) {
      reset({
        title: initialData.title,
        amount: Number(initialData.amount),
        currency: initialData.currency,
        type: initialData.type,
        categoryId: initialData.category?.id || initialData.categoryId || "",
        date: initialData.date ? format(new Date(initialData.date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
        paymentMethod: initialData.paymentMethod || "Other",
        notes: initialData.notes || "",
      });
    } else {
      const defaultCat = categories.find((c) => c.type === "expense")?.id || "";
      reset({
        title: "",
        amount: "" as any,
        currency: defaultCurrency,
        type: "expense",
        categoryId: defaultCat,
        date: format(new Date(), "yyyy-MM-dd"),
        paymentMethod: "Other",
        notes: "",
      });
    }
  }, [initialData, open, defaultCurrency, reset, categories]);

  // Set first category when switching type if current category doesn't match
  const handleTypeChange = (type: "income" | "expense") => {
    setValue("type", type);
    const matching = categories.filter((c) => c.type === type);
    if (matching.length > 0) {
      setValue("categoryId", matching[0].id);
    } else {
      setValue("categoryId", "");
    }
  };

  const onSubmit = async (data: TransactionInput) => {
    try {
      if (isEditing && initialData?.id) {
        await apiClient.put(`/transactions/${initialData.id}`, data);
      } else {
        await apiClient.post("/transactions", data);
      }
      onSuccess();
      onOpenChange(false);
      reset();
    } catch (err: any) {
      console.error("Save transaction failed:", err);
      alert(err.response?.data?.error || "Failed to save transaction");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Transaction" : "Add New Transaction"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {/* Type Toggle: Income vs Expense */}
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-[#F3F6FC] p-1">
            <button
              type="button"
              onClick={() => handleTypeChange("expense")}
              className={`rounded-md py-1.5 text-xs font-semibold transition-all ${selectedType === "expense"
                ? "bg-white text-[#F07862] shadow-sm"
                : "text-[#8992A3] hover:text-[#202735]"
                }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange("income")}
              className={`rounded-md py-1.5 text-xs font-semibold transition-all ${selectedType === "income"
                ? "bg-white text-[#269B72] shadow-sm"
                : "text-[#8992A3] hover:text-[#202735]"
                }`}
            >
              Income
            </button>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Title / Description</Label>
            <Input
              id="title"
              placeholder="e.g. Grocery store, Monthly salary"
              {...register("title")}
            />
            {errors.title && (
              <p className="text-xs text-[#F07862]">{errors.title.message}</p>
            )}
          </div>

          {/* Amount and Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={selectedCurrency}
                onValueChange={(val) => setValue("currency", val as SupportedCurrency)}
              >
                <SelectTrigger id="currency">
                  <SelectValue placeholder="Currency" />
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

            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="any"
                min="0.01"
                placeholder="0.00"
                {...register("amount", { valueAsNumber: true })}
              />
              {errors.amount && (
                <p className="text-xs text-[#F07862]">{errors.amount.message}</p>
              )}
            </div>
          </div>

          {/* Category & Payment Method */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="categoryId">Category</Label>
              <Select
                value={selectedCategory}
                onValueChange={(val) => setValue("categoryId", val)}
              >
                <SelectTrigger id="categoryId">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.categoryId && (
                <p className="text-xs text-[#F07862]">{errors.categoryId.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select
                value={selectedPaymentMethod}
                onValueChange={(val) => setValue("paymentMethod", val as any)}
              >
                <SelectTrigger id="paymentMethod">
                  <SelectValue placeholder="Payment Method" />
                </SelectTrigger>
                <SelectContent>
                  {["Cash", "Credit Card", "Debit Card", "Bank Transfer", "UPI", "Other"].map(
                    (m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" {...register("date")} />
            {errors.date && (
              <p className="text-xs text-[#F07862]">{errors.date.message}</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Input
              id="notes"
              placeholder="Additional details..."
              {...register("notes")}
            />
          </div>

          <DialogFooter className="mt-4 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#2878E5] hover:bg-[#1F65C2]"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : isEditing ? "Update" : "Add Transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
