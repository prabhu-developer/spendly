import mongoose, { Schema, Document, Model } from "mongoose";
import { SupportedCurrency } from "@/lib/currency/currencies";

export interface IBudget extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  categoryId: mongoose.Types.ObjectId;
  amount: number;
  currency: SupportedCurrency;
  month: number;
  year: number;
  createdAt: Date;
  updatedAt: Date;
}

const BudgetSchema = new Schema<IBudget>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, "Budget limit amount is required"],
      min: [1, "Budget must be at least 1"],
    },
    currency: {
      type: String,
      enum: ["INR", "USD", "EUR", "GBP", "AED", "SGD", "CAD", "AUD", "JPY", "SAR"],
      default: "USD",
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// One budget per category per month per user
BudgetSchema.index({ userId: 1, categoryId: 1, month: 1, year: 1 }, { unique: true });

export const Budget: Model<IBudget> =
  mongoose.models.Budget || mongoose.model<IBudget>("Budget", BudgetSchema);
