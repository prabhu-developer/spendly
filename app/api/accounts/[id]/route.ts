import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Account } from "@/models/Account";
import { Transaction } from "@/models/Transaction";
import { accountSchema } from "@/lib/validations/account";
import { recordAudit } from "@/lib/audit";
import { logError } from "@/lib/observability/logger";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await getCurrentUser(req);
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid account ID" }, { status: 400 });
    }
    const body = await req.json().catch(() => null);
    const validation = accountSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0]?.message || "Invalid account data" },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const userId = new mongoose.Types.ObjectId(session.userId);
    const existing = await Account.findOne({ _id: id, userId });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Account not found" }, { status: 404 });
    }

    // Changing currency would silently reinterpret the opening balance and history.
    if (validation.data.currency !== existing.currency) {
      const used = await Transaction.exists({ userId, accountId: existing._id });
      if (used) {
        return NextResponse.json(
          { success: false, error: "Currency can't be changed after transactions are linked to this account" },
          { status: 400 }
        );
      }
    }

    Object.assign(existing, validation.data);
    await existing.save();
    await recordAudit({ userId: session.userId, action: "account.update", entityId: id, req });

    return NextResponse.json({
      success: true,
      account: {
        id: existing._id.toString(),
        name: existing.name,
        type: existing.type,
        currency: existing.currency,
        openingBalance: existing.openingBalance,
        color: existing.color,
        isArchived: existing.isArchived,
      },
    });
  } catch (error) {
    logError("accounts.update_failed", error);
    return NextResponse.json({ success: false, error: "Failed to update account" }, { status: 500 });
  }
}

/**
 * Delete an account. Linked transactions are kept (never destroy financial history)
 * and become unassigned, so totals and net worth stay consistent.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await getCurrentUser(req);
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid account ID" }, { status: 400 });
    }
    await connectToDatabase();
    const userId = new mongoose.Types.ObjectId(session.userId);
    const deleted = await Account.findOneAndDelete({ _id: id, userId });
    if (!deleted) {
      return NextResponse.json({ success: false, error: "Account not found" }, { status: 404 });
    }
    const { modifiedCount } = await Transaction.updateMany(
      { userId, accountId: deleted._id },
      { $set: { accountId: null } }
    );
    await recordAudit({
      userId: session.userId,
      action: "account.delete",
      entityId: id,
      metadata: { unassignedTransactions: modifiedCount },
      req,
    });
    return NextResponse.json({ success: true, unassignedTransactions: modifiedCount });
  } catch (error) {
    logError("accounts.delete_failed", error);
    return NextResponse.json({ success: false, error: "Failed to delete account" }, { status: 500 });
  }
}
