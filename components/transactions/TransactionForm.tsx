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
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api/errors";
import { isNetworkError, queueTransactionDraft } from "@/lib/offline";
import { format } from "date-fns";
import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, type DefaultValues } from "react-hook-form";

const NO_ACCOUNT = "none";

export interface AccountOption {
  id: string;
  name: string;
  currency: SupportedCurrency;
  isArchived?: boolean;
}

interface TransactionFormProps {
  categories: Array<{ id: string; name: string; type: "income" | "expense" }>;
  /** Optional accounts to link the transaction to */
  accounts?: AccountOption[];
  /** Needed to save drafts on this device while offline (create only) */
  userId?: string;
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
  account?: { id: string } | null;
  date: string | Date;
  paymentMethod?: TransactionInput["paymentMethod"] | string;
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
    accountId: null,
  };
}

export function TransactionForm({
  categories,
  accounts = [],
  userId,
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
  const selectedAccountId = watch("accountId");
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  // New transactions in an account use that account's currency; edits keep their own currency.
  const transactionCurrency: SupportedCurrency =
    initialData?.currency || selectedAccount?.currency || defaultCurrency;
  const selectableAccounts = accounts.filter((a) => !a.isArchived || a.id === selectedAccountId);
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
        paymentMethod: (initialData.paymentMethod || "Other") as TransactionInput["paymentMethod"],
        notes: initialData.notes || "",
        accountId: initialData.account?.id ?? null,
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

    const payload = {
      ...data,
      currency: transactionCurrency,
      accountId: data.accountId || null,
    };

    const afterCreate = (message: string) => {
      if (keepOpenAfterCreate) {
        reset({ ...getDefaultValues(categories, defaultCurrency), accountId: payload.accountId });
        setSuccessMessage(message);
      }
    };

    // Offline (or the request never reached the server): keep the entry on this device.
    const saveOffline = async () => {
      if (isEditing || !userId) return false;
      await queueTransactionDraft(userId, {
        ...payload,
        date: String(payload.date),
        notes: payload.notes ?? "",
      });
      toast.success("Saved offline", {
        description: "It will sync automatically when you're back online.",
      });
      onSuccess(undefined);
      afterCreate("Saved on this device. It will sync when you reconnect. You can enter another one.");
      return true;
    };

    if (!isEditing && typeof navigator !== "undefined" && !navigator.onLine) {
      if (await saveOffline().catch(() => false)) return;
    }

    try {
      const response = isEditing && initialData?.id
        ? await apiClient.put(`/transactions/${initialData.id}`, payload)
        : await apiClient.post("/transactions", payload);

      toast.success(isEditing ? "Transaction updated" : "Transaction added");
      onSuccess(response.data.transaction);
      if (!isEditing) afterCreate("Transaction added. You can enter another one.");
    } catch (error: unknown) {
      if (isNetworkError(error) && (await saveOffline().catch(() => false))) return;
      setSubmitError(getErrorMessage(error, "Could not save this transaction. Please try again."));
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
          className="flex items-center gap-2 rounded-lg bg-income-light p-3 text-sm text-income-text"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {successMessage}
        </div>
      )}
      {submitError && (
        <div
          role="alert"
          className="rounded-lg border border-expense/30 bg-expense-light p-3 text-sm text-expense-text"
        >
          {submitError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
        {(["expense", "income"] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => handleTypeChange(type)}
            aria-pressed={selectedType === type}
            className={`min-h-11 rounded-md text-sm font-semibold capitalize transition-all ${selectedType === type
                ? type === "expense"
                  ? "bg-white text-expense-text shadow-sm"
                  : "bg-white text-income-text shadow-sm"
                : "text-muted-foreground hover:text-main"
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
          aria-describedby={errors.title ? "title-error" : undefined}
          {...register("title")}
        />
        {errors.title && (
          <p id="title-error" role="alert" className="text-sm text-expense-text">
            {errors.title.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">Amount {" "}
          <span id="amount-currency" className="text-xs text-muted-foreground">
            ({transactionCurrency})
          </span>
        </Label>
        <Input
          id="amount"
          type="number"
          inputMode="decimal"
          step="any"
          min="0.01"
          placeholder="0.00"
          className="h-12"
          aria-invalid={Boolean(errors.amount)}
          aria-describedby={errors.amount ? "amount-error" : "amount-currency"}
          {...register("amount", { valueAsNumber: true })}
        />

        {errors.amount && (
          <p id="amount-error" role="alert" className="text-sm text-expense-text">
            {errors.amount.message}
          </p>
        )}
      </div>

      <div className="flex gap-4 w-full">
        <div className="space-y-2 flex-1">
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
            <p className="text-sm text-expense-text">{errors.categoryId.message}</p>
          )}
        </div>
        <div className="space-y-2 flex-1">
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
      </div>

      {(selectableAccounts.length > 0 || selectedAccountId) && (
        <div className="space-y-2">
          <Label htmlFor="accountId">Account (optional)</Label>
          <Select
            value={selectedAccountId || NO_ACCOUNT}
            onValueChange={(value) =>
              setValue("accountId", value === NO_ACCOUNT ? null : value, { shouldDirty: true })
            }
          >
            <SelectTrigger id="accountId" className="h-12">
              <SelectValue placeholder="No account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_ACCOUNT}>No account</SelectItem>
              {selectableAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name} · {account.currency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}


      <div className="space-y-2">
        <Label htmlFor="date">Date</Label>
        <Input id="date" type="date" className="h-12" {...register("date")} />
        {errors.date && <p className="text-sm text-expense-text">{errors.date.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (Optional)</Label>
        <textarea
          id="notes"
          placeholder="Additional details..."
          rows={2}
          className="flex w-full resize-y rounded-lg border border-border bg-white px-3 py-3 text-sm text-main transition-[border-color,box-shadow] placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
          aria-invalid={Boolean(errors.notes)}
          {...register("notes")}
        />
        {errors.notes && <p className="text-sm text-expense-text">{errors.notes.message}</p>}
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
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
          className="min-h-11 w-full sm:w-auto"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Saving..." : isEditing ? "Update Transaction" : "Add Transaction"}
        </Button>
      </div>
    </form>
  );
}
