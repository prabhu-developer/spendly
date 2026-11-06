import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Budget } from "@/models/Budget";
import { Transaction } from "@/models/Transaction";
import { Category } from "@/models/Category";
import { budgetSchema } from "@/lib/validations/budget";
import { ExchangeRateService } from "@/lib/currency/exchangeRateService";
import { roundToTwoDecimals } from "@/lib/utils";
import mongoose from "mongoose";

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUser(req);
    if (!session || !session.userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const userObjectId = new mongoose.Types.ObjectId(session.userId);

    const { searchParams } = new URL(req.url);
    const currentDate = new Date();
    const month = parseInt(searchParams.get("month") || `${currentDate.getMonth() + 1}`, 10);
    const year = parseInt(searchParams.get("year") || `${currentDate.getFullYear()}`, 10);

    // Fetch user budgets for specified month & year
    const budgets = await Budget.find({
      userId: userObjectId,
      month,
      year,
    }).populate("categoryId", "name icon color type");

    // Fetch all expenses for this user in this month and year
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const expenses = await Transaction.find({
      userId: userObjectId,
      type: "expense",
      date: { $gte: startDate, $lte: endDate },
    }).lean();

    // Get exchange rates for converting currencies to user's preferred reporting currency
    const preferredCurrency = session.preferredCurrency || "USD";
    const ratesData = await ExchangeRateService.getExchangeRates();

    // Calculate spent per category
    const categorySpentMap = new Map<string, number>();
    for (const exp of expenses) {
      const catId = exp.categoryId.toString();
      const convertedAmount = ExchangeRateService.convertWithSnapshot(
        exp.amount,
        exp.currency,
        preferredCurrency,
        ratesData.rates
      );
      categorySpentMap.set(catId, (categorySpentMap.get(catId) || 0) + convertedAmount);
    }

    const formattedBudgets = budgets.map((b: any) => {
      const categoryIdStr = b.categoryId?._id ? b.categoryId._id.toString() : b.categoryId?.toString();
      const rawSpent = categorySpentMap.get(categoryIdStr) || 0;
      const spent = roundToTwoDecimals(rawSpent);

      // Convert budget amount to preferredCurrency if stored in different currency
      const budgetAmount = ExchangeRateService.convertWithSnapshot(
        b.amount,
        b.currency,
        preferredCurrency,
        ratesData.rates
      );

      const remaining = roundToTwoDecimals(Math.max(0, budgetAmount - spent));
      const percentage = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 100) : 0;
      const isExceeded = spent > budgetAmount;

      return {
        id: b._id.toString(),
        category: b.categoryId
          ? {
              id: b.categoryId._id.toString(),
              name: b.categoryId.name,
              icon: b.categoryId.icon,
              color: b.categoryId.color,
            }
          : {
              id: categoryIdStr,
              name: "Unknown Category",
              icon: "Tag",
              color: "#64748B",
            },
        amount: budgetAmount,
        originalAmount: b.amount,
        currency: preferredCurrency,
        originalCurrency: b.currency,
        month: b.month,
        year: b.year,
        spent,
        remaining,
        percentage,
        isExceeded,
      };
    });

    // Summary calculation
    const totalBudget = roundToTwoDecimals(
      formattedBudgets.reduce((acc, b) => acc + b.amount, 0)
    );
    const totalSpent = roundToTwoDecimals(
      formattedBudgets.reduce((acc, b) => acc + b.spent, 0)
    );
    const totalRemaining = roundToTwoDecimals(Math.max(0, totalBudget - totalSpent));
    const overallPercentage = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

    return NextResponse.json({
      success: true,
      budgets: formattedBudgets,
      summary: {
        totalBudget,
        totalSpent,
        totalRemaining,
        overallPercentage,
        currency: preferredCurrency,
      },
    });
  } catch (error: any) {
    console.error("Get budgets error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch budgets" },
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
    const validation = budgetSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0]?.message || "Invalid budget data" },
        { status: 400 }
      );
    }

    const { categoryId, amount, currency, month, year } = validation.data;

    await connectToDatabase();
    const userObjectId = new mongoose.Types.ObjectId(session.userId);

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

    // Upsert budget for this user, category, month, and year
    const budget = await Budget.findOneAndUpdate(
      {
        userId: userObjectId,
        categoryId: category._id,
        month,
        year,
      },
      {
        userId: userObjectId,
        categoryId: category._id,
        amount,
        currency,
        month,
        year,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json(
      {
        success: true,
        budget: {
          id: budget._id.toString(),
          categoryId: budget.categoryId.toString(),
          amount: budget.amount,
          currency: budget.currency,
          month: budget.month,
          year: budget.year,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Create/update budget error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save budget" },
      { status: 500 }
    );
  }
}
