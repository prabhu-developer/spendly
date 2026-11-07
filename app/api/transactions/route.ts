import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Transaction } from "@/models/Transaction";
import { Category } from "@/models/Category";
import { transactionSchema } from "@/lib/validations/transaction";
import { withServerTiming } from "@/lib/api/performance";
import { ExchangeRateService } from "@/lib/currency/exchangeRateService";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const requestStartedAt = performance.now();
  try {
    const session = await getCurrentUser(req);
    if (!session || !session.userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const userObjectId = new mongoose.Types.ObjectId(session.userId);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const type = searchParams.get("type");
    const categoryId = searchParams.get("categoryId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const sortBy = searchParams.get("sortBy") || "date";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? 1 : -1;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
    const skip = (page - 1) * limit;
    const includeTotal = searchParams.get("includeTotal") !== "false";
    const compact = searchParams.get("compact") === "true";

    const query: any = { userId: userObjectId };

    if (search) {
      query.title = { $regex: search, $options: "i" };
    }
    if (type && (type === "income" || type === "expense")) {
      query.type = type;
    }
    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
      query.categoryId = new mongoose.Types.ObjectId(categoryId);
    }
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        // Set to end of the day if date string only
        const end = new Date(endDate);
        if (endDate.length <= 10) {
          end.setHours(23, 59, 59, 999);
        }
        query.date.$lte = end;
      }
    }

    const sortOption: any = {};
    if (sortBy === "amount") {
      sortOption.amount = sortOrder;
    } else if (sortBy === "title") {
      sortOption.title = sortOrder;
    } else {
      sortOption.date = sortOrder;
    }

    const dataStartedAt = performance.now();
    const [total, transactions] = await Promise.all([
      includeTotal ? Transaction.countDocuments(query) : Promise.resolve(null),
      (() => {
        const transactionQuery = Transaction.find(query);
        if (compact) {
          transactionQuery.select(
            "title amount currency type date categoryId paymentMethod notes"
          );
        }
        return transactionQuery
          .populate("categoryId", "name icon color type")
          .sort(sortOption)
          .skip(skip)
          .limit(limit)
          .lean();
      })(),
    ]);
    const dataDuration = performance.now() - dataStartedAt;

    const formattedTransactions = transactions.map((t: any) => ({
      id: t._id.toString(),
      title: t.title,
      amount: t.amount,
      currency: t.currency,
      type: t.type,
      category: t.categoryId
        ? {
            id: t.categoryId._id.toString(),
            name: t.categoryId.name,
            icon: t.categoryId.icon,
            color: t.categoryId.color,
            type: t.categoryId.type,
          }
        : {
            id: "",
            name: "Uncategorized",
            icon: "Tag",
            color: "#64748B",
            type: t.type,
          },
      date: t.date.toISOString(),
      paymentMethod: t.paymentMethod,
      notes: t.notes || "",
      ...(!compact && {
        exchangeRateSnapshot: t.exchangeRateSnapshot,
        createdAt: t.createdAt.toISOString(),
      }),
    }));

    const response = NextResponse.json({
      success: true,
      transactions: formattedTransactions,
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
  } catch (error: any) {
    console.error("Get transactions error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser(req);
    if (!session || !session.userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validation = transactionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0]?.message || "Invalid transaction data" },
        { status: 400 }
      );
    }

    const { title, amount, currency, type, categoryId, date, paymentMethod, notes } = validation.data;

    await connectToDatabase();
    const userObjectId = new mongoose.Types.ObjectId(session.userId);

    // Validate category exists and is accessible by this user
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return NextResponse.json({ success: false, error: "Invalid category ID" }, { status: 400 });
    }

    const category = await Category.findOne({
      _id: categoryId,
      $or: [{ userId: userObjectId }, { isSystem: true }],
    });

    if (!category) {
      return NextResponse.json(
        { success: false, error: "Selected category does not exist" },
        { status: 400 }
      );
    }

    // Capture exchange rate snapshot
    const ratesData = await ExchangeRateService.getExchangeRates();
    const rateToUSD = ratesData.rates[currency] || 1;

    const newTransaction = await Transaction.create({
      userId: userObjectId,
      title,
      amount,
      currency,
      type,
      categoryId: category._id,
      date: new Date(date),
      paymentMethod,
      notes: notes || "",
      exchangeRateSnapshot: {
        base: "USD",
        rateToUSD,
        rateDate: ratesData.lastUpdated,
      },
    });

    return NextResponse.json(
      {
        success: true,
        transaction: {
          id: newTransaction._id.toString(),
          title: newTransaction.title,
          amount: newTransaction.amount,
          currency: newTransaction.currency,
          type: newTransaction.type,
          category: {
            id: category._id.toString(),
            name: category.name,
            icon: category.icon,
            color: category.color,
            type: category.type,
          },
          date: newTransaction.date.toISOString(),
          paymentMethod: newTransaction.paymentMethod,
          notes: newTransaction.notes,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Create transaction error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}
