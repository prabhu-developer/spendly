import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Transaction } from "@/models/Transaction";
import { ExchangeRateService } from "@/lib/currency/exchangeRateService";
import { roundToTwoDecimals } from "@/lib/utils";
import mongoose from "mongoose";
import { subMonths, startOfMonth, endOfMonth, format } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUser(req);
    if (!session || !session.userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const userObjectId = new mongoose.Types.ObjectId(session.userId);
    const preferredCurrency = session.preferredCurrency || "USD";

    const { searchParams } = new URL(req.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);

    const filterStartDate = startDateParam ? new Date(startDateParam) : currentMonthStart;
    const filterEndDate = endDateParam ? new Date(endDateParam) : currentMonthEnd;
    if (endDateParam && endDateParam.length <= 10) {
      filterEndDate.setHours(23, 59, 59, 999);
    }

    // Previous period for comparison
    const periodDuration = filterEndDate.getTime() - filterStartDate.getTime();
    const prevPeriodEnd = new Date(filterStartDate.getTime() - 1);
    const prevPeriodStart = new Date(prevPeriodEnd.getTime() - periodDuration);

    // Fetch exchange rates
    const ratesData = await ExchangeRateService.getExchangeRates();

    // 1. Current period transactions
    const currentTransactions = await Transaction.find({
      userId: userObjectId,
      date: { $gte: filterStartDate, $lte: filterEndDate },
    })
      .populate("categoryId", "name icon color type")
      .lean();

    // 2. Previous period transactions
    const prevTransactions = await Transaction.find({
      userId: userObjectId,
      date: { $gte: prevPeriodStart, $lte: prevPeriodEnd },
    }).lean();

    // Sum current period
    let totalIncome = 0;
    let totalExpenses = 0;
    const categoryBreakdownMap = new Map<string, { name: string; color: string; amount: number; count: number }>();

    for (const t of currentTransactions) {
      const converted = ExchangeRateService.convertWithSnapshot(
        t.amount,
        t.currency,
        preferredCurrency,
        ratesData.rates
      );

      if (t.type === "income") {
        totalIncome += converted;
      } else {
        totalExpenses += converted;
        const cat = (t.categoryId as any) || { _id: "other", name: "Other", color: "#64748B" };
        const catId = cat._id ? cat._id.toString() : "other";
        const existing = categoryBreakdownMap.get(catId) || {
          name: cat.name || "Other",
          color: cat.color || "#64748B",
          amount: 0,
          count: 0,
        };
        existing.amount += converted;
        existing.count += 1;
        categoryBreakdownMap.set(catId, existing);
      }
    }

    totalIncome = roundToTwoDecimals(totalIncome);
    totalExpenses = roundToTwoDecimals(totalExpenses);
    const totalSavings = roundToTwoDecimals(totalIncome - totalExpenses);
    const savingsRate = totalIncome > 0 ? Math.round((totalSavings / totalIncome) * 100) : 0;

    // Sum previous period
    let prevIncome = 0;
    let prevExpenses = 0;
    for (const t of prevTransactions) {
      const converted = ExchangeRateService.convertWithSnapshot(
        t.amount,
        t.currency,
        preferredCurrency,
        ratesData.rates
      );
      if (t.type === "income") {
        prevIncome += converted;
      } else {
        prevExpenses += converted;
      }
    }
    prevIncome = roundToTwoDecimals(prevIncome);
    prevExpenses = roundToTwoDecimals(prevExpenses);
    const prevSavings = roundToTwoDecimals(prevIncome - prevExpenses);

    // Percentage comparisons
    const incomeChange = prevIncome > 0 ? roundToTwoDecimals(((totalIncome - prevIncome) / prevIncome) * 100) : 0;
    const expensesChange = prevExpenses > 0 ? roundToTwoDecimals(((totalExpenses - prevExpenses) / prevExpenses) * 100) : 0;
    const savingsChange = prevSavings !== 0 ? roundToTwoDecimals(((totalSavings - prevSavings) / Math.abs(prevSavings)) * 100) : 0;

    // Category breakdown list
    const categoryBreakdown = Array.from(categoryBreakdownMap.values())
      .map((item) => ({
        ...item,
        amount: roundToTwoDecimals(item.amount),
        percentage: totalExpenses > 0 ? roundToTwoDecimals((item.amount / totalExpenses) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    // 3. Last 6 months monthly trend data
    const sixMonthsAgo = startOfMonth(subMonths(now, 5));
    const trendTransactions = await Transaction.find({
      userId: userObjectId,
      date: { $gte: sixMonthsAgo, $lte: currentMonthEnd },
    }).lean();

    const monthlyTrendMap = new Map<string, { month: string; income: number; expenses: number; savings: number }>();

    // Initialize 6 months slots
    for (let i = 5; i >= 0; i--) {
      const mDate = subMonths(now, i);
      const key = format(mDate, "MMM yyyy");
      monthlyTrendMap.set(key, { month: key, income: 0, expenses: 0, savings: 0 });
    }

    for (const t of trendTransactions) {
      const key = format(new Date(t.date), "MMM yyyy");
      if (monthlyTrendMap.has(key)) {
        const item = monthlyTrendMap.get(key)!;
        const converted = ExchangeRateService.convertWithSnapshot(
          t.amount,
          t.currency,
          preferredCurrency,
          ratesData.rates
        );
        if (t.type === "income") {
          item.income += converted;
        } else {
          item.expenses += converted;
        }
      }
    }

    const monthlyTrends = Array.from(monthlyTrendMap.values()).map((m) => ({
      month: m.month,
      income: roundToTwoDecimals(m.income),
      expenses: roundToTwoDecimals(m.expenses),
      savings: roundToTwoDecimals(m.income - m.expenses),
    }));

    return NextResponse.json({
      success: true,
      currency: preferredCurrency,
      isEstimate: ratesData.isFallback,
      summary: {
        totalIncome,
        totalExpenses,
        totalSavings,
        savingsRate,
        incomeChange,
        expensesChange,
        savingsChange,
      },
      categoryBreakdown,
      monthlyTrends,
      period: {
        startDate: filterStartDate.toISOString(),
        endDate: filterEndDate.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Get reports error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
