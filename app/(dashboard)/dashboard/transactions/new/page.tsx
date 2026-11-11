"use client";

import { Button } from "@/components/ui/button";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { isValidCurrency } from "@/lib/currency/currencies";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateFinancialData, useAccounts, useCategories, useCurrentUser } from "@/lib/api/queries";
import { OfflineDraftsPanel } from "@/components/offline/OfflineDraftsPanel";
import Link from "next/link";

export default function NewTransactionPage() {
  const queryClient = useQueryClient();
  const { data: user, isLoading: isUserLoading, isError: isUserError } = useCurrentUser();
  const {
    data: categories,
    isLoading: areCategoriesLoading,
    isError: areCategoriesError,
  } = useCategories();
  const { data: sheet } = useAccounts();
  const userId: string | undefined = user?.id ?? user?.userId;

  const currency = isValidCurrency(user?.preferredCurrency)
    ? user.preferredCurrency
    : null;
  const isLoading = isUserLoading || areCategoriesLoading;
  const loadError = isUserError || areCategoriesError;

  return (
    <div className="mx-auto max-w-2xl space-y-5">

      {userId && <OfflineDraftsPanel userId={userId} />}

      <section className="rounded-xl border border-border bg-white p-4 shadow-card sm:p-6">
        {isLoading ? (
          <div role="status" className="py-8 text-center text-sm text-muted-foreground">
            Loading your preferences and categories...
          </div>
        ) : loadError ? (
          <div
            role="alert"
            className="rounded-lg border border-expense/30 bg-expense-light p-4 text-sm text-expense-text"
          >
            Could not load your transaction settings. Please refresh the page and try again.
          </div>
        ) : !currency ? (
          <div
            role="alert"
            className="space-y-3 rounded-lg border border-expense/30 bg-expense-light p-4 text-sm text-main"
          >
            <p>Your preferred currency is not configured. Choose one in Account Settings before adding a transaction.</p>
            <Button asChild className="min-h-11">
              <Link href="/dashboard/settings">Open Account Settings</Link>
            </Button>
          </div>
        ) : !categories?.length ? (
          <div className="space-y-3 py-4">
            <p className="text-sm text-muted-foreground">
              Add a category before recording a transaction.
            </p>
            <Button asChild className="min-h-11">
              <Link href="/dashboard/categories">Manage Categories</Link>
            </Button>
          </div>
        ) : (
          <TransactionForm
            categories={categories}
            accounts={sheet?.accounts}
            userId={userId}
            defaultCurrency={currency}
            keepOpenAfterCreate
            onSuccess={() => void invalidateFinancialData(queryClient)}
          />
        )}
      </section>
    </div>
  );
}
