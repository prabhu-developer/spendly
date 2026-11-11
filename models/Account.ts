import mongoose, { Schema, Model } from "mongoose";
import { SUPPORTED_CURRENCY_CODES, type SupportedCurrency } from "@/lib/currency/currencies";

import { ACCOUNT_TYPES, type AccountType } from "@/lib/accounts/constants";

export { ACCOUNT_TYPES, LIABILITY_ACCOUNT_TYPES, type AccountType } from "@/lib/accounts/constants";

export interface IAccount {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  name: string;
  type: AccountType;
  currency: SupportedCurrency;
  /** Balance (in account currency) before any Spendly transactions. Negative for debt. */
  openingBalance: number;
  color: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AccountSchema = new Schema<IAccount>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    type: { type: String, enum: ACCOUNT_TYPES, required: true },
    currency: { type: String, enum: SUPPORTED_CURRENCY_CODES, required: true },
    openingBalance: { type: Number, default: 0 },
    color: { type: String, default: "#2878E5" },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

AccountSchema.index({ userId: 1, isArchived: 1, name: 1 });

export const Account: Model<IAccount> =
  mongoose.models.Account || mongoose.model<IAccount>("Account", AccountSchema);
