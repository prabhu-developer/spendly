// Client-safe account constants (no mongoose). The Account model re-exports these.
export const ACCOUNT_TYPES = [
  "checking",
  "savings",
  "credit_card",
  "cash",
  "investment",
  "loan",
  "wallet",
  "other",
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** Liability accounts usually carry a negative balance (money owed). */
export const LIABILITY_ACCOUNT_TYPES: readonly AccountType[] = ["credit_card", "loan"];
