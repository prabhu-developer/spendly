import { z } from "zod";

export const budgetSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  amount: z
    .number({ error: "Budget amount must be a number" })
    .positive("Budget amount must be greater than zero")
    .max(999999999, "Amount is too large"),
  currency: z.enum([
    "INR",
    "USD",
    "EUR",
    "GBP",
    "AED",
    "SGD",
    "CAD",
    "AUD",
    "JPY",
    "SAR",
  ]),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
});

export type BudgetInput = z.input<typeof budgetSchema>;
