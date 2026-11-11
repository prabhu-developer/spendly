import mongoose, { Schema, Document, Model } from "mongoose";
import { SupportedCurrency } from "@/lib/currency/currencies";

export interface IExchangeRateSnapshot {
  base: string;
  rateToUSD: number;
  rateDate: string;
}

export interface ITransaction extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  title: string;
  amount: number;
  currency: SupportedCurrency;
  type: "income" | "expense";
  categoryId: mongoose.Types.ObjectId;
  date: Date;
  paymentMethod: string;
  notes?: string;
  exchangeRateSnapshot?: IExchangeRateSnapshot;
  createdAt: Date;
  updatedAt: Date;
}

const ExchangeRateSnapshotSchema = new Schema<IExchangeRateSnapshot>(
  {
    base: { type: String, required: true },
    rateToUSD: { type: Number, required: true },
    rateDate: { type: String, required: true },
  },
  { _id: false }
);

const TransactionSchema = new Schema<ITransaction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: 150,
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0.01, "Amount must be greater than zero"],
    },
    currency: {
      type: String,
      enum: ["INR", "USD", "EUR", "GBP", "AED", "SGD", "CAD", "AUD", "JPY", "SAR"],
      required: true,
    },
    type: {
      type: String,
      enum: ["income", "expense"],
      required: true,
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    paymentMethod: {
      type: String,
      default: "Other",
      enum: ["Cash", "Credit Card", "Debit Card", "Bank Transfer", "UPI", "Other"],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    exchangeRateSnapshot: {
      type: ExchangeRateSnapshotSchema,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for performant multi-tenant queries
TransactionSchema.index({ userId: 1, date: -1 });
TransactionSchema.index({ userId: 1, type: 1, date: -1 });
// Category-filtered lists sorted by date, and budget spend lookups
TransactionSchema.index({ userId: 1, categoryId: 1, date: -1 });

export const Transaction: Model<ITransaction> =
  mongoose.models.Transaction || mongoose.model<ITransaction>("Transaction", TransactionSchema);
