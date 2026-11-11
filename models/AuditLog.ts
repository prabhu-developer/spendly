import mongoose, { Schema, Model } from "mongoose";

export interface IAuditLog {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId | null;
  action: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    action: { type: String, required: true },
    entityId: { type: String },
    metadata: { type: Schema.Types.Mixed },
    ip: { type: String },
    userAgent: { type: String, maxlength: 300 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

AuditLogSchema.index({ userId: 1, createdAt: -1 });
// Retain audit trail for 400 days
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 400 * 24 * 60 * 60 });

export const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
