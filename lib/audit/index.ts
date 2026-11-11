import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { AuditLog } from "@/models/AuditLog";
import { logError } from "@/lib/observability/logger";

export type AuditAction =
  | "auth.login"
  | "auth.login_failed"
  | "auth.logout"
  | "auth.register"
  | "user.profile_update"
  | "user.password_change"
  | "transaction.create"
  | "transaction.update"
  | "transaction.delete"
  | "transaction.bulk_delete"
  | "transaction.bulk_categorize"
  | "transaction.export"
  | "account.create"
  | "account.update"
  | "account.delete"
  | "budget.save"
  | "budget.delete"
  | "category.create"
  | "category.update"
  | "category.delete";

export function getClientIp(req?: NextRequest): string | undefined {
  if (!req) return undefined;
  const forwarded = req.headers.get("x-forwarded-for");
  return (forwarded?.split(",")[0] || req.headers.get("x-real-ip") || undefined)?.trim();
}

/**
 * Record an important financial/security action. Never throws: an audit write
 * failure is logged but must not break the user's request.
 * Metadata must never contain secrets (passwords, tokens) — ids and counts only.
 */
export async function recordAudit(entry: {
  userId: string | null;
  action: AuditAction;
  entityId?: string;
  metadata?: Record<string, unknown>;
  req?: NextRequest;
}): Promise<void> {
  try {
    await AuditLog.create({
      userId:
        entry.userId && mongoose.Types.ObjectId.isValid(entry.userId)
          ? new mongoose.Types.ObjectId(entry.userId)
          : null,
      action: entry.action,
      entityId: entry.entityId,
      metadata: entry.metadata,
      ip: getClientIp(entry.req),
      userAgent: entry.req?.headers.get("user-agent")?.slice(0, 300) ?? undefined,
    });
  } catch (error) {
    logError("audit.write_failed", error, { action: entry.action });
  }
}
