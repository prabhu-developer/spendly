import mongoose, { Schema, Model } from "mongoose";

export interface IRateLimit {
  key: string;
  identifier: string;
  count: number;
  expiresAt: Date;
}

const RateLimitSchema = new Schema<IRateLimit>(
  {
    key: { type: String, required: true, unique: true },
    identifier: { type: String, required: true, index: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false }
);

// MongoDB removes expired windows automatically
RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimit: Model<IRateLimit> =
  mongoose.models.RateLimit || mongoose.model<IRateLimit>("RateLimit", RateLimitSchema);
