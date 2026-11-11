import { NextRequest, NextResponse } from "next/server";
import { requireUser, parseJson, internalError } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Budget } from "@/models/Budget";
import { Transaction } from "@/models/Transaction";
import { Category } from "@/models/Category";
import { budgetSchema } from "@/lib/validations/budget";
import { ExchangeRateService } from "@/lib/currency/exchangeRateService";
import { roundToTwoDecimals } from "@/lib/utils";
import mongoose from "mongoose";
import type { SupportedCurrency } from "@/lib/currency/currencies";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if ("response" in auth) return auth.response;
    const { session, userObjectId } = auth;

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const currentDate = new Date();
    const month = parseInt(searchParams.get("month") || `${currentDate.getMonth() + 1}`, 10);
    const year = parseInt(searchParams.get("year") || `${currentDate.getFullYear()}`, 10);

    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
      return NextResponse.json({ success: false, error: "Invalid month or year" }, { status: 400 });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    const preferredCurrency = session.preferredCurrency || "USD";

    const [budgets, ratesData] = await Promise.all([
      Budget.find({ userId: userObjectId, month, year })
        .populate("categoryId", "name icon color type")
        .lean(),
      ExchangeRateService.getExchangeRates(),
    ]);

    // Sum spend per budgeted category (per currency) in MongoDB instead of loading every expense.
    const budgetCategoryIds = budgets
      .map((b: any) => b.categoryId?._id ?? b.categoryId)
      .filter(Boolean);
    const spentRows = budgetCategoryIds.length
      ? await Transaction.aggregate<{
          _id: { categoryId: mongoose.Types.ObjectId; currency: SupportedCurrency };
          amount: number;
        }>([
          {
            $match: {
              userId: userObjectId,
              type: "expense",
              categoryId: { $in: budgetCategoryIds },
              date: { $gte: startDate, $lte: endDate },
            },
          },
          {
            $group: {
              _id: { categoryId: "$categoryId", currency: "$currency" },
              amount: { $sum: "$amount" },
            },
          },
        ])
      : [];

    const categorySpentMap = new Map<string, number>();
    for (const row of spentRows) {
      const catId = row._id.categoryId.toString();
      const convertedAmount = ExchangeRateService.convertWithSnapshot(
        row.amount,
        row._id.currency,
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
  } catch (error) {
    return internalError("get_budgets_error", error, "Failed to fetch budgets", { route: "/api/budgets" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if ("response" in auth) return auth.response;
    const { session, userObjectId } = auth;

    const body = await parseJson(req, budgetSchema, "Invalid budget data");
    if ("response" in body) return body.response;

    const { categoryId, amount, currency, month, year } = body.data;

    await connectToDatabase();

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

    await recordAudit({
      userId: session.userId,
      action: "budget.save",
      entityId: budget._id.toString(),
      metadata: { month, year },
      req,
    });

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
  } catch (error) {
    return internalError("create_update_budget_error", error, "Failed to save budget", { route: "/api/budgets" });
  }
}
