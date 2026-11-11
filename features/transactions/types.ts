import type { SupportedCurrency } from "@/lib/currency/currencies";

export interface TransactionRow {
  id: string;
  title: string;
  amount: number;
  currency: SupportedCurrency;
  type: "income" | "expense";
  category: { id: string; name: string; icon: string; color: string; type: string };
  account: { id: string; name: string; color: string } | null;
  date: string;
  paymentMethod: string;
  notes: string;
  exchangeRateSnapshot?: { base: string; rateToUSD: number; rateDate: string };
  createdAt?: string;
}

export interface TransactionsResponse {
  transactions: TransactionRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
