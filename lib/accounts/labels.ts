import type { AccountType } from "@/models/Account";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Checking",
  savings: "Savings",
  credit_card: "Credit card",
  cash: "Cash",
  investment: "Investment",
  loan: "Loan",
  wallet: "Digital wallet",
  other: "Other",
};

export const ACCOUNT_COLORS = ["#2878E5", "#269B72", "#F07862", "#E9B949", "#7C5CDB", "#0E9AA7", "#D9467A", "#64748B"];
