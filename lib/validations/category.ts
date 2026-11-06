import { z } from "zod";

export const categorySchema = z.object({
  name: z
    .string()
    .min(1, "Category name is required")
    .max(50, "Category name cannot exceed 50 characters")
    .trim(),
  type: z.enum(["income", "expense"]),
  icon: z.string().default("Tag"),
  color: z
    .string()
    .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, "Must be a valid hex color code")
    .default("#2878E5"),
});

export type CategoryInput = z.infer<typeof categorySchema>;
