import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Transaction } from "@/models/Transaction";
import { Category } from "@/models/Category";
import { ExchangeRateService } from "@/lib/currency/exchangeRateService";
import { withServerTiming } from "@/lib/api/performance";
import { roundToTwoDecimals, percentChange } from "@/lib/utils";
import {
  buildMonthKeys,
  compareCategories,
  foldCashFlow,
  totalsByType,
  type CategoryAmount,
  type TxType,
} from "@/lib/reports/summarize";
import { resolveReportRange, serverTimezone } from "@/lib/reports/range";
import { logError } from "@/lib/observability/logger";
import type { SupportedCurrency } from "@/lib/currency/currencies";
import mongoose from "mongoose";
import { subMonths, startOfMonth, endOfMonth, format } from "date-fns";

export const dynamic = "force-dynamic";

type CategoryRow = {
  _id: { type: TxType; currency: SupportedCurrency; categoryId: mongoose.Types.ObjectId | null };
  amount: number;
  count: number;
};
type MonthRow = { _id: { month: string; type: TxType; currency: SupportedCurrency }; amount: number };
type CurrencyRow = { _id: { type: TxType; currency: SupportedCurrency }; amount: number };

const OTHER_CATEGORY = { name: "Other", color: "#64748B" };

export async function GET(req: NextRequest) {
  const requestStartedAt = performance.now();
  try {
    const session = await getCurrentUser(req);
    if (!session || !session.userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const range = resolveReportRange(searchParams);
    if (!range.ok) {
      return NextResponse.json({ success: false, error: range.error }, { status: 400 });
    }
    const { start: filterStartDate, end: filterEndDate, prevStart: prevPeriodStart, prevEnd: prevPeriodEnd } = range;

    await connectToDatabase();
    const userObjectId = new mongoose.Types.ObjectId(session.userId);
    const preferredCurrency: SupportedCurrency = session.preferredCurrency || "USD";

    const now = new Date();
    const currentMonthEnd = endOfMonth(now);
    const sixMonthsAgo = startOfMonth(subMonths(now, 5));
    const queryStartDate = prevPeriodStart < sixMonthsAgo ? prevPeriodStart : sixMonthsAgo;
    const queryEndDate = filterEndDate > currentMonthEnd ? filterEndDate : currentMonthEnd;

    const includeBalance = searchParams.get("includeBalance") === "true";
    // Bucket months in the server's timezone, matching date-fns `format` below.
    const timezone = serverTimezone();
    const monthExpr = { $dateToString: { format: "%Y-%m", date: "$date", timezone } };
    const byCategory = {
      $group: {
        _id: { type: "$type", currency: "$currency", categoryId: "$categoryId" },
        amount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    };
    const byMonth = {
      $group: {
        _id: { month: monthExpr, type: "$type", currency: "$currency" },
        amount: { $sum: "$amount" },
      },
    };

    const dataStartedAt = performance.now();
    // Aggregate in MongoDB so only small grouped buckets (not every transaction) reach Node.
    const [ratesData, [facets], balanceBuckets] = await Promise.all([
      ExchangeRateService.getExchangeRates(),
      Transaction.aggregate<{
        current: CategoryRow[];
        previous: CategoryRow[];
        trend: MonthRow[];
        cashFlow: MonthRow[];
      }>([
        { $match: { userId: userObjectId, date: { $gte: queryStartDate, $lte: queryEndDate } } },
        {
          $facet: {
            current: [{ $match: { date: { $gte: filterStartDate, $lte: filterEndDate } } }, byCategory],
            previous: [{ $match: { date: { $gte: prevPeriodStart, $lte: prevPeriodEnd } } }, byCategory],
            trend: [{ $match: { date: { $gte: sixMonthsAgo, $lte: currentMonthEnd } } }, byMonth],
            cashFlow: [{ $match: { date: { $gte: filterStartDate, $lte: filterEndDate } } }, byMonth],
          },
        },
      ]),
      includeBalance
        ? Transaction.aggregate<CurrencyRow>([
            { $match: { userId: userObjectId } },
            { $group: { _id: { type: "$type", currency: "$currency" }, amount: { $sum: "$amount" } } },
          ])
        : Promise.resolve(null),
    ]);

    // Resolve category display info for the (few) categories present in either period.
    const expenseCategoryIds = [...facets.current, ...facets.previous]
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

    /** Expense spend per category; deleted / missing categories are grouped under "Other". */
    const foldCategories = (rows: CategoryRow[]) => {
      const map = new Map<string, { id: string; name: string; color: string; amount: number; count: number }>();
      for (const row of rows) {
        if (row._id.type !== "expense") continue;
        const rawId = row._id.categoryId?.toString();
        const cat = rawId ? categoryInfo.get(rawId) : undefined;
        const key = cat ? rawId! : "other";
        const existing = map.get(key) || {
          id: key,
          name: cat?.name || OTHER_CATEGORY.name,
          color: cat?.color || OTHER_CATEGORY.color,
          amount: 0,
          count: 0,
        };
        existing.amount += convert(row.amount, row._id.currency);
        existing.count += row.count;
        map.set(key, existing);
      }
      return Array.from(map.values());
    };

    const totalIncome = currentTotals.income;
    const totalExpenses = currentTotals.expenses;
    const totalSavings = roundToTwoDecimals(totalIncome - totalExpenses);
    const savingsRate = totalIncome > 0 ? Math.round((totalSavings / totalIncome) * 100) : 0;

    const prevIncome = previousTotals.income;
    const prevExpenses = previousTotals.expenses;
    const prevSavings = roundToTwoDecimals(prevIncome - prevExpenses);
    const prevSavingsRate = prevIncome > 0 ? Math.round((prevSavings / prevIncome) * 100) : 0;

    const incomeChange = prevIncome > 0 ? percentChange(totalIncome, prevIncome) : 0;
    const expensesChange = prevExpenses > 0 ? percentChange(totalExpenses, prevExpenses) : 0;
    const savingsChange = percentChange(totalSavings, prevSavings);

    const currentCategories = foldCategories(facets.current);
    const categoryBreakdown = currentCategories
      .map((item) => ({
        ...item,
        amount: roundToTwoDecimals(item.amount),
        percentage: totalExpenses > 0 ? roundToTwoDecimals((item.amount / totalExpenses) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const categoryComparison = compareCategories(
      currentCategories as CategoryAmount[],
      foldCategories(facets.previous) as CategoryAmount[]
    );

    // Fixed trailing 6 months (kept for dashboard backward compatibility)
    const trendMonths = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, 5 - i);
      return { key: format(d, "yyyy-MM"), label: format(d, "MMM yyyy") };
    });
    const monthlyTrends = foldCashFlow(
      facets.trend.map((r) => ({ ...toBucket(r), month: r._id.month })),
      trendMonths,
      preferredCurrency,
      ratesData.rates
    ).map((m) => ({ month: m.month, income: m.income, expenses: m.expenses, savings: m.net }));

    // Selected-range cash flow, every month filled
    const cashFlow = foldCashFlow(
      facets.cashFlow.map((r) => ({ ...toBucket(r), month: r._id.month })),
      buildMonthKeys(filterStartDate, filterEndDate),
      preferredCurrency,
      ratesData.rates
    );

    let totalBalance: number | undefined;
    if (balanceBuckets) {
      const allTime = totalsByType(balanceBuckets.map(toBucket), preferredCurrency, ratesData.rates);
      totalBalance = roundToTwoDecimals(allTime.income - allTime.expenses);
    }

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
      previousSummary: {
        totalIncome: prevIncome,
        totalExpenses: prevExpenses,
        totalSavings: prevSavings,
        savingsRate: prevSavingsRate,
      },
      categoryBreakdown,
      categoryComparison,
      monthlyTrends,
      cashFlow,
      period: {
        startDate: filterStartDate.toISOString(),
        endDate: filterEndDate.toISOString(),
      },
      previousPeriod: {
        startDate: prevPeriodStart.toISOString(),
        endDate: prevPeriodEnd.toISOString(),
      },
    });
    return withServerTiming(response, requestStartedAt, { data: dataDuration });
  } catch (error: unknown) {
    logError("reports.summary_failed", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
