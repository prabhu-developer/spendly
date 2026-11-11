import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Transaction } from "@/models/Transaction";
import { Category } from "@/models/Category";
import { Account } from "@/models/Account";
import { recordAudit } from "@/lib/audit";
import { logError } from "@/lib/observability/logger";
import { bulkSchema } from "@/lib/transactions/bulk";

/**
 * Bulk operations on the caller's own transactions. Every write is scoped by
 * userId, so ids belonging to other users are silently ignored (never touched).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser(req);
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const parsed = bulkSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Invalid request" },
        { status: 400 }
      );
    }
    const body = parsed.data;

    await connectToDatabase();
    const userId = new mongoose.Types.ObjectId(session.userId);
    const scope = {
      userId,
      _id: { $in: Array.from(new Set(body.ids)).map((id) => new mongoose.Types.ObjectId(id)) },
    };

    if (body.action === "delete") {
      const { deletedCount } = await Transaction.deleteMany(scope);
      await recordAudit({
        userId: session.userId,
        action: "transaction.bulk_delete",
        metadata: { requested: body.ids.length, deleted: deletedCount, ids: body.ids.slice(0, 100) },
        req,
      });
      return NextResponse.json({ success: true, affected: deletedCount });
    }

    if (body.action === "categorize") {
      const category = await Category.findOne({
        _id: body.categoryId,
        $or: [{ userId }, { isSystem: true }],
      })
        .select("type")
        .lean();
      if (!category) {
        return NextResponse.json({ success: false, error: "Selected category does not exist" }, { status: 400 });
      }
      // Only re-categorize transactions of the matching type (income vs expense)
      const { modifiedCount, matchedCount } = await Transaction.updateMany(
        { ...scope, type: category.type },
        { $set: { categoryId: category._id } }
      );
      await recordAudit({
        userId: session.userId,
        action: "transaction.bulk_categorize",
        entityId: body.categoryId,
        metadata: { requested: body.ids.length, modified: modifiedCount },
        req,
      });
      return NextResponse.json({
        success: true,
        affected: modifiedCount,
        skipped: body.ids.length - matchedCount,
      });
    }

    // assignAccount
    if (body.accountId) {
      const exists = await Account.exists({ _id: body.accountId, userId });
      if (!exists) {
        return NextResponse.json({ success: false, error: "Selected account does not exist" }, { status: 400 });
      }
    }
    const { modifiedCount } = await Transaction.updateMany(scope, {
      $set: { accountId: body.accountId ? new mongoose.Types.ObjectId(body.accountId) : null },
    });
    await recordAudit({
      userId: session.userId,
      action: "transaction.update",
      entityId: body.accountId ?? undefined,
      metadata: { bulk: true, assignAccount: true, modified: modifiedCount },
      req,
    });
    return NextResponse.json({ success: true, affected: modifiedCount });
  } catch (error) {
    logError("transactions.bulk_failed", error);
    return NextResponse.json({ success: false, error: "Bulk update failed" }, { status: 500 });
  }
}
