import mongoose from "mongoose";
import { z } from "zod";

export const MAX_BULK_IDS = 500;

const objectId = z.string().refine((v) => mongoose.Types.ObjectId.isValid(v), "Invalid id");
const ids = z
  .array(objectId)
  .min(1, "Select at least one transaction")
  .max(MAX_BULK_IDS, `You can update up to ${MAX_BULK_IDS} transactions at once`);

export const bulkSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("delete"), ids }),
  z.object({ action: z.literal("categorize"), ids, categoryId: objectId }),
  z.object({ action: z.literal("assignAccount"), ids, accountId: objectId.nullable() }),
]);

export type BulkRequest = z.infer<typeof bulkSchema>;
