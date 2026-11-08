"use client";

import { Button } from "@/components/ui/button";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { apiClient } from "@/lib/api/client";
import { isValidCurrency } from "@/lib/currency/currencies";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

export default function NewTransactionPage() {
  const queryClient = useQueryClient();
  const {
    data: user,
    isLoading: isUserLoading,
    isError: isUserError,
  } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const response = await apiClient.get("/auth/me");
      return response.data.user;
    },
  });
  const {
    data: categories,
    isLoading: areCategoriesLoading,
    isError: areCategoriesError,
  } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await apiClient.get("/categories");
      return response.data.categories;
    },
  });

  const currency = isValidCurrency(user?.preferredCurrency)
    ? user.preferredCurrency
    : null;
  const isLoading = isUserLoading || areCategoriesLoading;
  const loadError = isUserError || areCategoriesError;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link
          href="/dashboard/transactions"
          className="inline-flex min-h-11 items-center text-sm font-medium text-[#2878E5] hover:underline"
        >
          &larr; Back to transactions
        </Link>
        <h2 className="mt-2 text-xl font-bold tracking-tight text-[#202735]">
          Add Transaction
        </h2>
        <p className="mt-1 text-sm text-[#8992A3]">
          Record an income or expense. You can add another transaction after saving.
        </p>
      </div>

      <section className="rounded-xl border border-[#E8EDF4] bg-white p-4 shadow-sm sm:p-6">
        {isLoading ? (
          <div role="status" className="py-8 text-center text-sm text-[#8992A3]">
            Loading your preferences and categories...
          </div>
        ) : loadError ? (
          <div
            role="alert"
            className="rounded-lg border border-[#F07862]/30 bg-[#FDF1EE] p-4 text-sm text-[#F07862]"
          >
            Could not load your transaction settings. Please refresh the page and try again.
          </div>
        ) : !currency ? (
          <div
            role="alert"
            className="space-y-3 rounded-lg border border-[#F07862]/30 bg-[#FDF1EE] p-4 text-sm text-[#202735]"
          >
            <p>Your preferred currency is not configured. Choose one in Account Settings before adding a transaction.</p>
            <Button asChild className="min-h-11 bg-[#2878E5] hover:bg-[#1F65C2]">
              <Link href="/dashboard/settings">Open Account Settings</Link>
            </Button>
          </div>
        ) : !categories?.length ? (
          <div className="space-y-3 py-4">
            <p className="text-sm text-[#8992A3]">
              Add a category before recording a transaction.
            </p>
            <Button asChild className="min-h-11 bg-[#2878E5] hover:bg-[#1F65C2]">
              <Link href="/dashboard/categories">Manage Categories</Link>
            </Button>
          </div>
        ) : (
          <TransactionForm
            categories={categories}
            defaultCurrency={currency}
            keepOpenAfterCreate
            onSuccess={() => {
              void Promise.all([
                queryClient.invalidateQueries({ queryKey: ["reports"] }),
                queryClient.invalidateQueries({ queryKey: ["reportsDetail"] }),
                queryClient.invalidateQueries({ queryKey: ["recentTransactions"] }),
                queryClient.invalidateQueries({ queryKey: ["transactions"] }),
                queryClient.invalidateQueries({ queryKey: ["budgets"] }),
              ]);
            }}
          />
        )}
      </section>
    </div>
  );
}
