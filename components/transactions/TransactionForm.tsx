"use client";

import { Button } from "@/components/ui/button";
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
import { SUPPORTED_CURRENCIES, SupportedCurrency } from "@/lib/currency/currencies";
import { TransactionInput, transactionSchema } from "@/lib/validations/transaction";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { format } from "date-fns";
import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, type DefaultValues } from "react-hook-form";

interface TransactionFormProps {
  categories: Array<{ id: string; name: string; type: "income" | "expense" }>;
  defaultCurrency: SupportedCurrency;
  initialData?: TransactionRecord | null;
  keepOpenAfterCreate?: boolean;
  onSuccess: (transaction?: unknown) => void;
  onCancel?: () => void;
}

export interface TransactionRecord {
  id: string;
  title: string;
  amount: number;
  currency: SupportedCurrency;
  type: "income" | "expense";
  categoryId?: string;
  category?: { id: string } | null;
  date: string | Date;
  paymentMethod?: TransactionInput["paymentMethod"];
  notes?: string;
}

function getDefaultValues(
  categories: TransactionFormProps["categories"],
  currency: SupportedCurrency
): DefaultValues<TransactionInput> {
  return {
    title: "",
    currency,
    type: "expense",
    categoryId: categories.find((category) => category.type === "expense")?.id || "",
    date: format(new Date(), "yyyy-MM-dd"),
    paymentMethod: "Other",
    notes: "",
  };
}

export function TransactionForm({
  categories,
  defaultCurrency,
  initialData,
  keepOpenAfterCreate = false,
  onSuccess,
  onCancel,
}: TransactionFormProps) {
  const isEditing = Boolean(initialData);
  const [successMessage, setSuccessMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TransactionInput>({
    resolver: zodResolver(transactionSchema),
    defaultValues: getDefaultValues(categories, defaultCurrency),
  });

  const selectedType = watch("type");
  const selectedCategory = watch("categoryId");
  const selectedPaymentMethod = watch("paymentMethod");
  const transactionCurrency = initialData?.currency || defaultCurrency;
  const availableCategories = categories.filter((category) => category.type === selectedType);

  useEffect(() => {
    if (initialData) {
      reset({
        title: initialData.title,
        amount: Number(initialData.amount),
        currency: initialData.currency,
        type: initialData.type,
        categoryId: initialData.category?.id || initialData.categoryId || "",
        date: initialData.date
          ? format(new Date(initialData.date), "yyyy-MM-dd")
          : format(new Date(), "yyyy-MM-dd"),
        paymentMethod: initialData.paymentMethod || "Other",
        notes: initialData.notes || "",
      });
    } else {
      reset(getDefaultValues(categories, defaultCurrency));
    }
    setSuccessMessage("");
    setSubmitError("");
  }, [categories, defaultCurrency, initialData, reset]);

  const handleTypeChange = (type: "income" | "expense") => {
    setValue("type", type, { shouldDirty: true, shouldValidate: true });
    setValue(
      "categoryId",
      categories.find((category) => category.type === type)?.id || "",
      { shouldDirty: true, shouldValidate: true }
    );
  };

  const onSubmit = async (data: TransactionInput) => {
    setSubmitError("");
    setSuccessMessage("");

    try {
      const payload = {
        ...data,
        currency: transactionCurrency,
      };
      const response = isEditing && initialData?.id
        ? await apiClient.put(`/transactions/${initialData.id}`, payload)
        : await apiClient.post("/transactions", payload);

      onSuccess(response.data.transaction);
      if (keepOpenAfterCreate && !isEditing) {
        reset(getDefaultValues(categories, defaultCurrency));
        setSuccessMessage("Transaction added. You can enter another one.");
      }
    } catch (error: unknown) {
      console.error("Save transaction failed:", error);
      const apiError = axios.isAxiosError<{ error?: string }>(error)
        ? error.response?.data?.error
        : undefined;
      setSubmitError(apiError || "Could not save this transaction. Please try again.");
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-5 pb-[env(safe-area-inset-bottom,0px)]"
    >
      {successMessage && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg bg-[#EAF6F1] p-3 text-sm text-[#269B72]"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {successMessage}
        </div>
      )}
      {submitError && (
        <div
          role="alert"
          className="rounded-lg border border-[#F07862]/30 bg-[#FDF1EE] p-3 text-sm text-[#F07862]"
        >
          {submitError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 rounded-lg bg-[#F3F6FC] p-1">
        {(["expense", "income"] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => handleTypeChange(type)}
            aria-pressed={selectedType === type}
            className={`min-h-11 rounded-md text-sm font-semibold capitalize transition-all ${
              selectedType === type
                ? type === "expense"
                  ? "bg-white text-[#F07862] shadow-sm"
                  : "bg-white text-[#269B72] shadow-sm"
                : "text-[#8992A3] hover:text-[#202735]"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title / Description</Label>
        <Input
          id="title"
          placeholder="e.g. Grocery store, Monthly salary"
          autoComplete="off"
          className="h-12"
          aria-invalid={Boolean(errors.title)}
          {...register("title")}
        />
        {errors.title && <p className="text-sm text-[#F07862]">{errors.title.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">Amount</Label>
        <Input
          id="amount"
          type="number"
          inputMode="decimal"
          step="any"
          min="0.01"
          placeholder="0.00"
          className="h-12"
          aria-invalid={Boolean(errors.amount)}
          {...register("amount", { valueAsNumber: true })}
        />
        <p className="text-xs text-[#8992A3]">
          In {SUPPORTED_CURRENCIES[transactionCurrency].name} ({transactionCurrency})
        </p>
        {errors.amount && <p className="text-sm text-[#F07862]">{errors.amount.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="categoryId">Category</Label>
        <Select
          value={selectedCategory}
          onValueChange={(value) =>
            setValue("categoryId", value, { shouldDirty: true, shouldValidate: true })
          }
        >
          <SelectTrigger
            id="categoryId"
            className="h-12"
            aria-invalid={Boolean(errors.categoryId)}
          >
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {availableCategories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.categoryId && (
          <p className="text-sm text-[#F07862]">{errors.categoryId.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="paymentMethod">Payment Method</Label>
        <Select
          value={selectedPaymentMethod}
          onValueChange={(value) =>
            setValue("paymentMethod", value as TransactionInput["paymentMethod"], {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        >
          <SelectTrigger id="paymentMethod" className="h-12">
            <SelectValue placeholder="Payment method" />
          </SelectTrigger>
          <SelectContent>
            {["Cash", "Credit Card", "Debit Card", "Bank Transfer", "UPI", "Other"].map(
              (method) => (
                <SelectItem key={method} value={method}>
                  {method}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="date">Date</Label>
        <Input id="date" type="date" className="h-12" {...register("date")} />
        {errors.date && <p className="text-sm text-[#F07862]">{errors.date.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (Optional)</Label>
        <textarea
          id="notes"
          placeholder="Additional details..."
          rows={3}
          className="flex min-h-24 w-full resize-y rounded-lg border border-[#E8EDF4] bg-white px-3 py-3 text-sm text-[#202735] ring-offset-white placeholder:text-[#8992A3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2878E5] disabled:cursor-not-allowed disabled:opacity-50"
          aria-invalid={Boolean(errors.notes)}
          {...register("notes")}
        />
        {errors.notes && <p className="text-sm text-[#F07862]">{errors.notes.message}</p>}
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-[#E8EDF4] pt-4 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full sm:w-auto"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          className="min-h-11 w-full bg-[#2878E5] hover:bg-[#1F65C2] sm:w-auto"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Saving..." : isEditing ? "Update Transaction" : "Add Transaction"}
        </Button>
      </div>
    </form>
  );
}
