import { z } from "zod";
import { ACCOUNT_TYPES } from "@/models/Account";
import { SUPPORTED_CURRENCY_CODES } from "@/lib/currency/currencies";

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export const accountSchema = z.object({
  name: z.string().trim().min(1, "Account name is required").max(60, "Name cannot exceed 60 characters"),
  type: z.enum(ACCOUNT_TYPES, { error: "Choose an account type" }),
  currency: z.enum(SUPPORTED_CURRENCY_CODES as [string, ...string[]], { error: "Choose a currency" }),
  openingBalance: z
    .number({ error: "Opening balance must be a number" })
    .min(-999999999, "Amount is too large")
    .max(999999999, "Amount is too large")
    .default(0),
  color: z.string().regex(HEX_COLOR, "Invalid color").default("#2878E5"),
  isArchived: z.boolean().optional().default(false),
});

export type AccountInput = z.input<typeof accountSchema>;
