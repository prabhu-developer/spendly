import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Transaction } from "@/models/Transaction";
import { ExchangeRateService } from "@/lib/currency/exchangeRateService";
import { withServerTiming } from "@/lib/api/performance";
import { roundToTwoDecimals, percentChange } from "@/lib/utils";
import { Category } from "@/models/Category";
import { totalsByType, type TxType } from "@/lib/reports/summarize";
import type { SupportedCurrency } from "@/lib/currency/currencies";
import mongoose from "mongoose";
import { subMonths, startOfMonth, endOfMonth, format } from "date-fns";

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
    const preferredCurrency: SupportedCurrency = session.preferredCurrency || "USD";

    const { searchParams } = new URL(req.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);

    const filterStartDate = startDateParam ? new Date(startDateParam) : currentMonthStart;
    const filterEndDate = endDateParam ? new Date(endDateParam) : currentMonthEnd;
    if (
      Number.isNaN(filterStartDate.getTime()) ||
      Number.isNaN(filterEndDate.getTime()) ||
      filterStartDate > filterEndDate
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid report date range" },
        { status: 400 }
      );
    }
    if (endDateParam && endDateParam.length <= 10) {
      filterEndDate.setHours(23, 59, 59, 999);
    }

    // Previous period for comparison
    const periodDuration = filterEndDate.getTime() - filterStartDate.getTime();
    const prevPeriodEnd = new Date(filterStartDate.getTime() - 1);
    const prevPeriodStart = new Date(prevPeriodEnd.getTime() - periodDuration);

    const sixMonthsAgo = startOfMonth(subMonths(now, 5));
    const queryStartDate = prevPeriodStart < sixMonthsAgo ? prevPeriodStart : sixMonthsAgo;
    const queryEndDate = filterEndDate > currentMonthEnd ? filterEndDate : currentMonthEnd;

    const includeBalance = searchParams.get("includeBalance") === "true";
    // Bucket months in the server's timezone, matching date-fns `format` below.
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

    const dataStartedAt = performance.now();
    // Aggregate in MongoDB so only small grouped buckets (not every transaction) reach Node.
    const [ratesData, [facets], balanceBuckets] = await Promise.all([
      ExchangeRateService.getExchangeRates(),
      Transaction.aggregate<{
        current: { _id: { type: TxType; currency: SupportedCurrency; categoryId: mongoose.Types.ObjectId | null }; amount: number; count: number }[];
        previous: { _id: { type: TxType; currency: SupportedCurrency }; amount: number }[];
        trend: { _id: { month: string; type: TxType; currency: SupportedCurrency }; amount: number }[];
      }>([
        { $match: { userId: userObjectId, date: { $gte: queryStartDate, $lte: queryEndDate } } },
        {
          $facet: {
            current: [
              { $match: { date: { $gte: filterStartDate, $lte: filterEndDate } } },
              {
                $group: {
                  _id: { type: "$type", currency: "$currency", categoryId: "$categoryId" },
                  amount: { $sum: "$amount" },
                  count: { $sum: 1 },
                },
              },
            ],
            previous: [
              { $match: { date: { $gte: prevPeriodStart, $lte: prevPeriodEnd } } },
              { $group: { _id: { type: "$type", currency: "$currency" }, amount: { $sum: "$amount" } } },
            ],
            trend: [
              { $match: { date: { $gte: sixMonthsAgo, $lte: currentMonthEnd } } },
              {
                $group: {
                  _id: {
                    month: { $dateToString: { format: "%Y-%m", date: "$date", timezone } },
                    type: "$type",
                    currency: "$currency",
                  },
                  amount: { $sum: "$amount" },
                },
              },
            ],
          },
        },
      ]),
      includeBalance
        ? Transaction.aggregate<{ _id: { type: TxType; currency: SupportedCurrency }; amount: number }>([
            { $match: { userId: userObjectId } },
            { $group: { _id: { type: "$type", currency: "$currency" }, amount: { $sum: "$amount" } } },
          ])
        : Promise.resolve(null),
    ]);

    // Resolve category display info for the (few) categories present in the period.
    const expenseCategoryIds = facets.current
      .filter((row) => row._id.type === "expense" && row._id.categoryId)
      .map((row) => row._id.categoryId as mongoose.Types.ObjectId);
    const categoryDocs = expenseCategoryIds.length
      ? await Category.find({ _id: { $in: expenseCategoryIds } }).select("name color").lean()
      : [];
    const dataDuration = performance.now() - dataStartedAt;

    const categoryInfo = new Map(categoryDocs.map((c) => [c._id.toString(), c]));
    const convert = (amount: number, currency: SupportedCurrency) =>
      ExchangeRateService.convertWithSnapshot(amount, currency, preferredCurrency, ratesData.rates);
    const toBucket = (row: { _id: { type: TxType; currency: SupportedCurrency }; amount: number }) => ({
      type: row._id.type,
      currency: row._id.currency,
      amount: row.amount,
    });

    const currentTotals = totalsByType(facets.current.map(toBucket), preferredCurrency, ratesData.rates);
    const previousTotals = totalsByType(facets.previous.map(toBucket), preferredCurrency, ratesData.rates);

    const categoryBreakdownMap = new Map<string, { name: string; color: string; amount: number; count: number }>();
    for (const row of facets.current) {
      if (row._id.type !== "expense") continue;
      const rawId = row._id.categoryId?.toString();
      const cat = rawId ? categoryInfo.get(rawId) : undefined;
      // Deleted / missing categories are grouped under "Other", as before.
      const key = cat ? rawId! : "other";
      const existing = categoryBreakdownMap.get(key) || {
        name: cat?.name || "Other",
        color: cat?.color || "#64748B",
        amount: 0,
        count: 0,
      };
      existing.amount += convert(row.amount, row._id.currency);
      existing.count += row.count;
      categoryBreakdownMap.set(key, existing);
    }

    const monthlyTrendMap = new Map<string, { month: string; income: number; expenses: number }>();
    for (let i = 5; i >= 0; i--) {
      const mDate = subMonths(now, i);
      monthlyTrendMap.set(format(mDate, "yyyy-MM"), { month: format(mDate, "MMM yyyy"), income: 0, expenses: 0 });
    }
    for (const row of facets.trend) {
      const bucket = monthlyTrendMap.get(row._id.month);
      if (!bucket) continue;
      const converted = convert(row.amount, row._id.currency);
      if (row._id.type === "income") bucket.income += converted;
      else bucket.expenses += converted;
    }

    const totalIncome = currentTotals.income;
    const totalExpenses = currentTotals.expenses;
    const totalSavings = roundToTwoDecimals(totalIncome - totalExpenses);
    const savingsRate = totalIncome > 0 ? Math.round((totalSavings / totalIncome) * 100) : 0;

    const prevIncome = previousTotals.income;
    const prevExpenses = previousTotals.expenses;
    const prevSavings = roundToTwoDecimals(prevIncome - prevExpenses);

    const incomeChange = prevIncome > 0 ? percentChange(totalIncome, prevIncome) : 0;
    const expensesChange = prevExpenses > 0 ? percentChange(totalExpenses, prevExpenses) : 0;
    const savingsChange = percentChange(totalSavings, prevSavings);

    let totalBalance: number | undefined;
    if (balanceBuckets) {
      const allTime = totalsByType(balanceBuckets.map(toBucket), preferredCurrency, ratesData.rates);
      totalBalance = roundToTwoDecimals(allTime.income - allTime.expenses);
    }

    // Category breakdown list
    const categoryBreakdown = Array.from(categoryBreakdownMap.values())
      .map((item) => ({
        ...item,
        amount: roundToTwoDecimals(item.amount),
        percentage: totalExpenses > 0 ? roundToTwoDecimals((item.amount / totalExpenses) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const monthlyTrends = Array.from(monthlyTrendMap.values()).map((m) => ({
      month: m.month,
      income: roundToTwoDecimals(m.income),
      expenses: roundToTwoDecimals(m.expenses),
      savings: roundToTwoDecimals(m.income - m.expenses),
    }));

    const response = NextResponse.json({
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
        ...(totalBalance !== undefined && { totalBalance }),
      },
      categoryBreakdown,
      monthlyTrends,
      period: {
        startDate: filterStartDate.toISOString(),
        endDate: filterEndDate.toISOString(),
      },
    });
    return withServerTiming(response, requestStartedAt, { data: dataDuration });
  } catch (error: any) {
    console.error("Get reports error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
