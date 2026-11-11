import mongoose from "mongoose";
import { z } from "zod";
import { escapeRegex } from "@/lib/utils";

const objectId = z.string().refine((v) => mongoose.Types.ObjectId.isValid(v), "Invalid id");
const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Invalid date");
const amount = z.coerce.number().min(0).max(999999999);

/** Query-string filters shared by list, export and bulk endpoints. */
export const transactionFilterSchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    type: z.enum(["income", "expense"]).optional(),
    categoryId: objectId.optional(),
    // "unassigned" selects transactions not linked to any account
    accountId: z.union([objectId, z.literal("unassigned")]).optional(),
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
    minAmount: amount.optional(),
    maxAmount: amount.optional(),
  })
  .refine(
    (f) => f.minAmount === undefined || f.maxAmount === undefined || f.minAmount <= f.maxAmount,
    { message: "Minimum amount can't exceed maximum amount" }
  );

export type TransactionFilters = z.infer<typeof transactionFilterSchema>;

const FILTER_KEYS = [
  "search",
  "type",
  "categoryId",
  "accountId",
  "startDate",
  "endDate",
  "minAmount",
  "maxAmount",
] as const;

export function parseTransactionFilters(
  searchParams: URLSearchParams
): { success: true; filters: TransactionFilters } | { success: false; error: string } {
  const raw: Record<string, string> = {};
  for (const key of FILTER_KEYS) {
    const value = searchParams.get(key);
    // Treat "", "all" as no filter (matches existing UI conventions)
    if (value !== null && value !== "" && value !== "all") raw[key] = value;
  }
  const parsed = transactionFilterSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid filters" };
  }
  return { success: true, filters: parsed.data };
}

/** Build a userId-scoped MongoDB filter. userId is always applied (tenant isolation). */
export function buildTransactionQuery(
  userId: mongoose.Types.ObjectId,
  f: TransactionFilters
): Record<string, unknown> {
  const query: Record<string, unknown> = { userId };
  if (f.search) query.title = { $regex: escapeRegex(f.search), $options: "i" };
  if (f.type) query.type = f.type;
  if (f.categoryId) query.categoryId = new mongoose.Types.ObjectId(f.categoryId);
  if (f.accountId === "unassigned") query.accountId = null;
  else if (f.accountId) query.accountId = new mongoose.Types.ObjectId(f.accountId);

  if (f.startDate || f.endDate) {
    const date: Record<string, Date> = {};
    if (f.startDate) date.$gte = new Date(f.startDate);
    if (f.endDate) {
      const end = new Date(f.endDate);
      // Date-only strings include the whole day
      if (f.endDate.length <= 10) end.setHours(23, 59, 59, 999);
      date.$lte = end;
    }
    query.date = date;
  }
  if (f.minAmount !== undefined || f.maxAmount !== undefined) {
    const amountRange: Record<string, number> = {};
    if (f.minAmount !== undefined) amountRange.$gte = f.minAmount;
    if (f.maxAmount !== undefined) amountRange.$lte = f.maxAmount;
    query.amount = amountRange;
  }
  return query;
}

type PopulatedRef = { _id: mongoose.Types.ObjectId; name?: string; icon?: string; color?: string; type?: string } | null;

/** Serialize a lean, populated transaction to the public API shape. */
export function serializeTransaction(
  t: Record<string, any>,
  { compact = false }: { compact?: boolean } = {}
) {
  const cat = t.categoryId as PopulatedRef;
  const acc = t.accountId as PopulatedRef;
  return {
    id: t._id.toString(),
    title: t.title,
    amount: t.amount,
    currency: t.currency,
    type: t.type,
    category: cat
      ? { id: cat._id.toString(), name: cat.name, icon: cat.icon, color: cat.color, type: cat.type }
      : { id: "", name: "Uncategorized", icon: "Tag", color: "#64748B", type: t.type },
    account: acc && acc._id ? { id: acc._id.toString(), name: acc.name, color: acc.color } : null,
    date: new Date(t.date).toISOString(),
    paymentMethod: t.paymentMethod,
    notes: t.notes || "",
    ...(!compact && {
      exchangeRateSnapshot: t.exchangeRateSnapshot,
      createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : undefined,
    }),
  };
}
