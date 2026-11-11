import { z } from "zod";

export const transactionSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(150, "Title cannot exceed 150 characters")
    .trim(),
  amount: z
    .number({ error: "Amount must be a number" })
    .positive("Amount must be greater than zero")
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
  type: z.enum(["income", "expense"]),
  categoryId: z.string().min(1, "Category is required"),
  date: z.string().or(z.date()),
  paymentMethod: z
    .enum(["Cash", "Credit Card", "Debit Card", "Bank Transfer", "UPI", "Other"])
    .default("Other"),
  notes: z.string().max(500, "Notes cannot exceed 500 characters").optional().default(""),
  accountId: z.string().nullable().optional(),
  clientRequestId: z.string().min(8).max(64).optional(),
});

export type TransactionInput = z.input<typeof transactionSchema>;
