import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireUser } from "@/lib/auth/guard";
import { enforceWriteRateLimit } from "@/lib/auth/rateLimiter";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Transaction } from "@/models/Transaction";
import { Category } from "@/models/Category";
import { Account } from "@/models/Account";
import { User } from "@/models/User";
import { transactionSchema } from "@/lib/validations/transaction";
import { withServerTiming } from "@/lib/api/performance";
import { ExchangeRateService } from "@/lib/currency/exchangeRateService";
import { isValidCurrency } from "@/lib/currency/currencies";
import {
  buildTransactionQuery,
  parseTransactionFilters,
  serializeTransaction,
} from "@/lib/transactions/filters";
import { recordAudit } from "@/lib/audit";
import { logError } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

const MAX_PAGE_SIZE = 200;
const LIST_FIELDS =
  "title amount currency type date categoryId accountId paymentMethod notes exchangeRateSnapshot createdAt";
const COMPACT_FIELDS = "title amount currency type date categoryId accountId paymentMethod notes";

export async function GET(req: NextRequest) {
  const requestStartedAt = performance.now();
  try {
    const auth = await requireUser(req);
    if ("response" in auth) return auth.response;
    const { session } = auth;

    const { searchParams } = new URL(req.url);
    const parsed = parseTransactionFilters(searchParams);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }

    const sortBy = searchParams.get("sortBy") || "date";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? 1 : -1;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get("limit") || "10", 10) || 10)
    );
    const skip = (page - 1) * limit;
    const includeTotal = searchParams.get("includeTotal") !== "false";
    const compact = searchParams.get("compact") === "true";

    await connectToDatabase();
    const userObjectId = new mongoose.Types.ObjectId(session.userId);
    const query = buildTransactionQuery(userObjectId, parsed.filters);

    // Stable ordering: tie-break on _id so pagination never repeats/skips rows
    const sortField = sortBy === "amount" ? "amount" : sortBy === "title" ? "title" : "date";
    const sortOption: Record<string, 1 | -1> = { [sortField]: sortOrder, _id: sortOrder };

    const dataStartedAt = performance.now();
    const [total, transactions] = await Promise.all([
      includeTotal ? Transaction.countDocuments(query) : Promise.resolve(null),
      Transaction.find(query)
        .select(compact ? COMPACT_FIELDS : LIST_FIELDS)
        .populate("categoryId", "name icon color type")
        .populate("accountId", "name color")
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);
    const dataDuration = performance.now() - dataStartedAt;

    const response = NextResponse.json({
      success: true,
      transactions: transactions.map((t) => serializeTransaction(t, { compact })),
      pagination: {
        page,
        limit,
        ...(total !== null && {
          total,
          totalPages: Math.ceil(total / limit) || 1,
        }),
      },
    });
    return withServerTiming(response, requestStartedAt, { data: dataDuration });
  } catch (error) {
    logError("transactions.list_failed", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if ("response" in auth) return auth.response;
    const { session } = auth;
    const limited = await enforceWriteRateLimit(session.userId);
    if (limited) return limited;

    const body = await req.json().catch(() => null);
    const validation = transactionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0]?.message || "Invalid transaction data" },
        { status: 400 }
      );
    }

    const { title, amount, type, categoryId, date, paymentMethod, notes, accountId, clientRequestId } =
      validation.data;

    await connectToDatabase();
    const userObjectId = new mongoose.Types.ObjectId(session.userId);

    // Idempotency: an offline draft retried after a lost response must not create a duplicate
    if (clientRequestId) {
      const existing = await Transaction.findOne({ userId: userObjectId, clientRequestId })
        .populate("categoryId", "name icon color type")
        .populate("accountId", "name color")
        .lean();
      if (existing) {
        return NextResponse.json({
          success: true,
          duplicate: true,
          transaction: serializeTransaction(existing, { compact: true }),
        });
      }
    }

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return NextResponse.json({ success: false, error: "Invalid category ID" }, { status: 400 });
    }
    if (accountId && !mongoose.Types.ObjectId.isValid(accountId)) {
      return NextResponse.json({ success: false, error: "Invalid account ID" }, { status: 400 });
    }

    const [user, category, account] = await Promise.all([
      User.findById(userObjectId).select("preferredCurrency").lean(),
      Category.findOne({
        _id: categoryId,
        $or: [{ userId: userObjectId }, { isSystem: true }],
      }).lean(),
      accountId
        ? Account.findOne({ _id: accountId, userId: userObjectId }).select("name color currency").lean()
        : Promise.resolve(null),
    ]);

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }
    if (!category) {
      return NextResponse.json(
        { success: false, error: "Selected category does not exist" },
        { status: 400 }
      );
    }
    if (accountId && !account) {
      return NextResponse.json(
        { success: false, error: "Selected account does not exist" },
        { status: 400 }
      );
    }

    // Money moving through an account is recorded in that account's currency;
    // otherwise the user's preferred currency (existing behaviour).
    const currency = account?.currency ?? user.preferredCurrency;
    if (!isValidCurrency(currency)) {
      return NextResponse.json(
        {
          success: false,
          error: "Preferred currency is not configured. Update it in Account Settings.",
        },
        { status: 400 }
      );
    }

    const ratesData = await ExchangeRateService.getExchangeRates();
    const rateToUSD = ratesData.rates[currency] || 1;

    let created;
    try {
      created = await Transaction.create({
        userId: userObjectId,
        title,
        amount,
        currency,
        type,
        categoryId: category._id,
        accountId: account?._id ?? null,
        date: new Date(date),
        paymentMethod,
        notes: notes || "",
        ...(clientRequestId && { clientRequestId }),
        exchangeRateSnapshot: {
          base: "USD",
          rateToUSD,
          rateDate: ratesData.lastUpdated,
        },
      });
    } catch (error) {
      // Concurrent retry of the same draft lost the race: return the winner
      if ((error as { code?: number }).code === 11000 && clientRequestId) {
        const existing = await Transaction.findOne({ userId: userObjectId, clientRequestId })
          .populate("categoryId", "name icon color type")
          .populate("accountId", "name color")
          .lean();
        if (existing) {
          return NextResponse.json({
            success: true,
            duplicate: true,
            transaction: serializeTransaction(existing, { compact: true }),
          });
        }
      }
      throw error;
    }

    await recordAudit({
      userId: session.userId,
      action: "transaction.create",
      entityId: created._id.toString(),
      metadata: { offline: Boolean(clientRequestId) },
      req,
    });

    return NextResponse.json(
      {
        success: true,
        transaction: serializeTransaction(
          { ...created.toObject(), categoryId: category, accountId: account },
          { compact: true }
        ),
      },
      { status: 201 }
    );
  } catch (error) {
    logError("transactions.create_failed", error);
    return NextResponse.json(
      { success: false, error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}
