import mongoose, { Schema, Document, Model } from "mongoose";
import { SupportedCurrency } from "@/lib/currency/currencies";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  preferredCurrency: SupportedCurrency;
  dateFormat: string;
  sessionVersion?: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, "Password hash is required"],
    },
    preferredCurrency: {
      type: String,
      enum: ["INR", "USD", "EUR", "GBP", "AED", "SGD", "CAD", "AUD", "JPY", "SAR"],
      default: "USD",
    },
    dateFormat: {
      type: String,
      default: "MM/dd/yyyy",
    },
    // Bumped on password change to revoke previously issued sessions
    sessionVersion: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent re-compilation of model during hot reload
export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
