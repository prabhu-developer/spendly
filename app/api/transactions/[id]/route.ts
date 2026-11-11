import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Transaction } from "@/models/Transaction";
import { Category } from "@/models/Category";
import { transactionSchema } from "@/lib/validations/transaction";
import { ExchangeRateService } from "@/lib/currency/exchangeRateService";
import mongoose from "mongoose";
import { Account } from "@/models/Account";
import { serializeTransaction } from "@/lib/transactions/filters";
import { recordAudit } from "@/lib/audit";
import { logError } from "@/lib/observability/logger";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getCurrentUser(req);
    if (!session || !session.userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid transaction ID" }, { status: 400 });
    }

    await connectToDatabase();
    const transaction = await Transaction.findOne({
      _id: id,
      userId: new mongoose.Types.ObjectId(session.userId),
    })
      .populate("categoryId", "name icon color type")
      .populate("accountId", "name color")
      .lean();

    if (!transaction) {
      return NextResponse.json({ success: false, error: "Transaction not found" }, { status: 404 });
    }

    const serialized = serializeTransaction(transaction);
    return NextResponse.json({
      success: true,
      // Legacy shape: category is null when missing on the detail endpoint
      transaction: { ...serialized, category: transaction.categoryId ? serialized.category : null },
    });
  } catch (error) {
    logError("transactions.get_failed", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch transaction details" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getCurrentUser(req);
    if (!session || !session.userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid transaction ID" }, { status: 400 });
    }

    const body = await req.json();
    const validation = transactionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { title, amount, currency, type, categoryId, date, paymentMethod, notes, accountId } =
      validation.data;
    if (accountId && !mongoose.Types.ObjectId.isValid(accountId)) {
      return NextResponse.json({ success: false, error: "Invalid account ID" }, { status: 400 });
    }

    await connectToDatabase();
    const userObjectId = new mongoose.Types.ObjectId(session.userId);

    // Strict ownership verification: only update transaction owned by authenticated user
    const existingTransaction = await Transaction.findOne({
      _id: id,
      userId: userObjectId,
    });

    if (!existingTransaction) {
      return NextResponse.json(
        { success: false, error: "Transaction not found or unauthorized" },
        { status: 404 }
      );
    }

    // Verify category exists
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return NextResponse.json({ success: false, error: "Invalid category ID" }, { status: 400 });
    }

    const category = await Category.findOne({
      _id: categoryId,
      $or: [{ userId: userObjectId }, { isSystem: true }],
    });

    if (!category) {
      return NextResponse.json({ success: false, error: "Selected category does not exist" }, { status: 400 });
    }

    // accountId: undefined → leave unchanged, null/"" → unassign, id → must be the user's account
    let account: { _id: mongoose.Types.ObjectId; name: string; color: string } | null = null;
    if (accountId) {
      account = await Account.findOne({ _id: accountId, userId: userObjectId })
        .select("name color")
        .lean();
      if (!account) {
        return NextResponse.json(
          { success: false, error: "Selected account does not exist" },
          { status: 400 }
        );
      }
    }

    // Capture before overwriting, so the snapshot refresh check below is meaningful
    const currencyChanged = existingTransaction.currency !== currency;

    // Update fields
    existingTransaction.title = title;
    existingTransaction.amount = amount;
    existingTransaction.currency = currency;
    existingTransaction.type = type;
    existingTransaction.categoryId = category._id;
    existingTransaction.date = new Date(date);
    existingTransaction.paymentMethod = paymentMethod;
    existingTransaction.notes = notes || "";
    if (accountId !== undefined) {
      existingTransaction.accountId = account ? account._id : null;
    }

    // If currency changed or no snapshot existed, update snapshot
    if (currencyChanged || !existingTransaction.exchangeRateSnapshot) {
      const ratesData = await ExchangeRateService.getExchangeRates();
      const rateToUSD = ratesData.rates[currency] || 1;
      existingTransaction.exchangeRateSnapshot = {
        base: "USD",
        rateToUSD,
        rateDate: ratesData.lastUpdated,
      };
    }

    await existingTransaction.save();
    await recordAudit({ userId: session.userId, action: "transaction.update", entityId: id, req });

    return NextResponse.json({
      success: true,
      transaction: {
        id: existingTransaction._id.toString(),
        title: existingTransaction.title,
        amount: existingTransaction.amount,
        currency: existingTransaction.currency,
        type: existingTransaction.type,
        category: {
          id: category._id.toString(),
          name: category.name,
          icon: category.icon,
          color: category.color,
          type: category.type,
        },
        date: existingTransaction.date.toISOString(),
        paymentMethod: existingTransaction.paymentMethod,
        notes: existingTransaction.notes,
        ...(accountId !== undefined && {
          account: account
            ? { id: account._id.toString(), name: account.name, color: account.color }
            : null,
        }),
      },
    });
  } catch (error) {
    logError("transactions.update_failed", error);
    return NextResponse.json(
      { success: false, error: "Failed to update transaction" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getCurrentUser(req);
    if (!session || !session.userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid transaction ID" }, { status: 400 });
    }

    await connectToDatabase();
    const userObjectId = new mongoose.Types.ObjectId(session.userId);

    const deleted = await Transaction.findOneAndDelete({
      _id: id,
      userId: userObjectId,
    });

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Transaction not found or unauthorized" },
        { status: 404 }
      );
    }

    await recordAudit({
      userId: session.userId,
      action: "transaction.delete",
      entityId: id,
      metadata: { amount: deleted.amount, currency: deleted.currency, type: deleted.type },
      req,
    });

    return NextResponse.json({
      success: true,
      message: "Transaction deleted successfully",
    });
  } catch (error) {
    logError("transactions.delete_failed", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete transaction" },
      { status: 500 }
    );
  }
}
