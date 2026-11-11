"use client";

import { useQuery, type QueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { SupportedCurrency } from "@/lib/currency/currencies";
import type { AccountType } from "@/lib/accounts/constants";

/** Every query key holding derived financial data. Mutations invalidate them together. */
export const FINANCIAL_QUERY_KEYS = [
  ["transactions"],
  ["recentTransactions"],
  ["reports"],
  ["reportsDetail"],
  ["reportsInsights"],
  ["budgets"],
  ["accounts"],
] as const;

export function invalidateFinancialData(queryClient: QueryClient) {
  return Promise.all(
    FINANCIAL_QUERY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey }))
  );
}

export interface CategoryOption {
  id: string;
  name: string;
  type: "income" | "expense";
  icon: string;
  color: string;
}

export interface AccountSummary {
  id: string;
  name: string;
  type: AccountType;
  currency: SupportedCurrency;
  openingBalance: number;
  color: string;
  isArchived: boolean;
  balance: number;
  convertedBalance: number;
}

export interface BalanceSheetResponse {
  accounts: AccountSummary[];
  unassignedBalance: number;
  netWorth: number;
  assets: number;
  liabilities: number;
  currency: SupportedCurrency;
  isEstimate: boolean;
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["currentUser"],
    staleTime: 60_000,
    queryFn: async ({ signal }) => (await apiClient.get("/auth/me", { signal })).data.user,
  });
}

export function useCategories() {
  return useQuery<CategoryOption[]>({
    queryKey: ["categories"],
    staleTime: 60_000,
    queryFn: async ({ signal }) => (await apiClient.get("/categories", { signal })).data.categories,
  });
}

export function useAccounts() {
  return useQuery<BalanceSheetResponse>({
    queryKey: ["accounts"],
    staleTime: 30_000,
    queryFn: async ({ signal }) => (await apiClient.get("/accounts", { signal })).data,
  });
}
