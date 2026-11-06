import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICategory extends Document {
  _id: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId | null;
  name: string;
  type: "income" | "expense";
  icon: string;
  color: string;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      maxlength: 50,
    },
    type: {
      type: String,
      enum: ["income", "expense"],
      required: true,
    },
    icon: {
      type: String,
      default: "Tag",
    },
    color: {
      type: String,
      default: "#2878E5",
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for user categories lookup
CategorySchema.index({ userId: 1, type: 1 });

export const Category: Model<ICategory> =
  mongoose.models.Category || mongoose.model<ICategory>("Category", CategorySchema);
