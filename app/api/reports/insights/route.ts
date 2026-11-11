import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Transaction } from "@/models/Transaction";
import { Budget } from "@/models/Budget";
import { Category } from "@/models/Category";
import { Account } from "@/models/Account";
import { ExchangeRateService } from "@/lib/currency/exchangeRateService";
import { SUPPORTED_CURRENCY_CODES, type SupportedCurrency } from "@/lib/currency/currencies";
import { getBalanceSheet } from "@/lib/accounts/balances";
import { withServerTiming } from "@/lib/api/performance";
import { logError } from "@/lib/observability/logger";
import { roundToTwoDecimals } from "@/lib/utils";
import { resolveReportRange, serverTimezone } from "@/lib/reports/range";
import {
  buildMonthKeys,
  conversionFactor,
  convertedAmountExpr,
  detectRecurring,
  foldNetWorthTrend,
  totalsByType,
  type TitleMonthSeries,
  type TxType,
} from "@/lib/reports/summarize";

export const dynamic = "force-dynamic";

type MonthRow = { _id: { month: string; type: TxType; currency: SupportedCurrency }; amount: number };
type CurrencyRow = { _id: { type: TxType; currency: SupportedCurrency }; amount: number; count: number };

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
    const { start, end } = range;

    await connectToDatabase();
    const userId = new mongoose.Types.ObjectId(session.userId);
    const preferred: SupportedCurrency = session.preferredCurrency || "USD";
    const timezone = serverTimezone();
    const monthExpr = { $dateToString: { format: "%Y-%m", date: "$date", timezone } };
    const normalizedTitle = { $toLower: { $trim: { input: "$title" } } };

    const ratesData = await ExchangeRateService.getExchangeRates();
    const rates = ratesData.rates;
    const converted = convertedAmountExpr(SUPPORTED_CURRENCY_CODES, preferred, rates);

    // Recurring detection looks at the 6 calendar months ending with the range end
    const recurringStart = startOfMonth(subMonths(end, 5));
    const recurringEnd = endOfMonth(end);
    // Budgets are monthly: evaluate whole months touched by the range
    const budgetStart = startOfMonth(start);
    const budgetEnd = endOfMonth(end);
    const months = buildMonthKeys(start, end);
    const monthIndex = (key: string) => {
      const [y, m] = key.split("-").map(Number);
      return y * 100 + m;
    };

    const dataStartedAt = performance.now();
    const [facetResult, budgets, balanceSheet, accountDocs] = await Promise.all([
      Transaction.aggregate<{
        merchants: { _id: string; title: string; total: number; count: number }[];
        currencies: CurrencyRow[];
        priorFlows: CurrencyRow[];
        monthlyFlows: MonthRow[];
      }>([
        { $match: { userId } },
        {
          $facet: {
            merchants: [
              { $match: { type: "expense", date: { $gte: start, $lte: end } } },
              {
                $group: {
                  _id: normalizedTitle,
                  title: { $first: "$title" },
                  total: { $sum: converted },
                  count: { $sum: 1 },
                },
              },
              { $sort: { total: -1 } },
              { $limit: 10 },
            ],
            currencies: [
              { $match: { date: { $gte: start, $lte: end } } },
              {
                $group: {
                  _id: { type: "$type", currency: "$currency" },
                  amount: { $sum: "$amount" },
                  count: { $sum: 1 },
                },
              },
            ],
            priorFlows: [
              { $match: { date: { $lt: start } } },
              {
                $group: {
                  _id: { type: "$type", currency: "$currency" },
                  amount: { $sum: "$amount" },
                  count: { $sum: 1 },
                },
              },
            ],
            monthlyFlows: [
              { $match: { date: { $gte: start, $lte: end } } },
              {
                $group: {
                  _id: { month: monthExpr, type: "$type", currency: "$currency" },
                  amount: { $sum: "$amount" },
                },
              },
            ],
          },
        },
      ]),
      Budget.find({
        userId,
        $expr: {
          $and: [
            { $gte: [{ $add: [{ $multiply: ["$year", 100] }, "$month"] }, monthIndex(months[0].key)] },
            { $lte: [{ $add: [{ $multiply: ["$year", 100] }, "$month"] }, monthIndex(months.at(-1)!.key)] },
          ],
        },
      })
        .select("categoryId amount currency month year")
        .lean(),
      getBalanceSheet(userId, preferred, rates),
      Account.find({ userId }).select("openingBalance currency createdAt").lean(),
    ]);
    const [facets] = facetResult;

    // Recurring: title × month series (only titles seen in ≥3 months reach Node)
    const recurringRows = await Transaction.aggregate<{
      _id: string;
      title: string;
      months: { month: string; amount: number; count: number }[];
    }>([
      { $match: { userId, type: "expense", date: { $gte: recurringStart, $lte: recurringEnd } } },
      {
        $group: {
          _id: { key: normalizedTitle, month: monthExpr },
          title: { $first: "$title" },
          amount: { $sum: converted },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.key",
          title: { $first: "$title" },
          months: { $push: { month: "$_id.month", amount: "$amount", count: "$count" } },
        },
      },
      { $match: { "months.2": { $exists: true } } },
      { $limit: 500 },
    ]);

    // Budget actuals: expense per category × month for budgeted categories only
    const budgetCategoryIds = [...new Set(budgets.map((b) => b.categoryId.toString()))].map(
      (id) => new mongoose.Types.ObjectId(id)
    );
    const [budgetActualRows, budgetCategories] = budgetCategoryIds.length
      ? await Promise.all([
          Transaction.aggregate<{
            _id: { categoryId: mongoose.Types.ObjectId; month: string; currency: SupportedCurrency };
            amount: number;
          }>([
            {
              $match: {
                userId,
                type: "expense",
                categoryId: { $in: budgetCategoryIds },
                date: { $gte: budgetStart, $lte: budgetEnd },
              },
            },
            {
              $group: {
                _id: { categoryId: "$categoryId", month: monthExpr, currency: "$currency" },
                amount: { $sum: "$amount" },
              },
            },
          ]),
          Category.find({ _id: { $in: budgetCategoryIds } }).select("name color").lean(),
        ])
      : [[], []];
    const dataDuration = performance.now() - dataStartedAt;

    const convert = (amount: number, currency: SupportedCurrency) =>
      ExchangeRateService.convertWithSnapshot(amount, currency, preferred, rates);

    // --- Merchants
    const merchants = facets.merchants.map((m) => ({
      key: m._id,
      title: m.title,
      total: roundToTwoDecimals(m.total),
      count: m.count,
      average: roundToTwoDecimals(m.total / Math.max(1, m.count)),
    }));

    // --- Recurring
    const recurring = detectRecurring(
      recurringRows.map<TitleMonthSeries>((r) => ({ key: r._id, title: r.title, months: r.months }))
    );

    // --- Currencies
    const currencyMap = new Map<
      SupportedCurrency,
      { currency: SupportedCurrency; income: number; expenses: number; convertedIncome: number; convertedExpenses: number; count: number }
    >();
    for (const row of facets.currencies) {
      const entry = currencyMap.get(row._id.currency) ?? {
        currency: row._id.currency,
        income: 0,
        expenses: 0,
        convertedIncome: 0,
        convertedExpenses: 0,
        count: 0,
      };
      if (row._id.type === "income") {
        entry.income += row.amount;
        entry.convertedIncome += convert(row.amount, row._id.currency);
      } else {
        entry.expenses += row.amount;
        entry.convertedExpenses += convert(row.amount, row._id.currency);
      }
      entry.count += row.count;
      currencyMap.set(row._id.currency, entry);
    }
    const currencies = Array.from(currencyMap.values())
      .map((c) => ({
        ...c,
        income: roundToTwoDecimals(c.income),
        expenses: roundToTwoDecimals(c.expenses),
        convertedIncome: roundToTwoDecimals(c.convertedIncome),
        convertedExpenses: roundToTwoDecimals(c.convertedExpenses),
        rate: Math.round(conversionFactor(c.currency, preferred, rates) * 1e6) / 1e6,
      }))
      .sort((a, b) => b.convertedExpenses + b.convertedIncome - (a.convertedExpenses + a.convertedIncome));

    // --- Budget performance (per category, summed over months in range)
    const actualByKey = new Map<string, number>();
    for (const row of budgetActualRows) {
      const key = `${row._id.categoryId.toString()}|${row._id.month}`;
      actualByKey.set(key, (actualByKey.get(key) ?? 0) + convert(row.amount, row._id.currency));
    }
    const categoryMeta = new Map(budgetCategories.map((c) => [c._id.toString(), c]));
    const perCategory = new Map<string, { id: string; name: string; color: string; budget: number; actual: number; months: number; overMonths: number }>();
    for (const b of budgets) {
      const id = b.categoryId.toString();
      const monthKey = `${b.year}-${String(b.month).padStart(2, "0")}`;
      const budgetAmount = convert(b.amount, b.currency);
      const actual = actualByKey.get(`${id}|${monthKey}`) ?? 0;
      const meta = categoryMeta.get(id);
      const entry = perCategory.get(id) ?? {
        id,
        name: meta?.name ?? "Deleted category",
        color: meta?.color ?? "#64748B",
        budget: 0,
        actual: 0,
        months: 0,
        overMonths: 0,
      };
      entry.budget += budgetAmount;
      entry.actual += actual;
      entry.months += 1;
      if (actual > budgetAmount) entry.overMonths += 1;
      perCategory.set(id, entry);
    }
    const budgetRows = Array.from(perCategory.values())
      .map((c) => ({
        ...c,
        budget: roundToTwoDecimals(c.budget),
        actual: roundToTwoDecimals(c.actual),
        variance: roundToTwoDecimals(c.budget - c.actual),
        percentage: c.budget > 0 ? Math.round((c.actual / c.budget) * 100) : 0,
      }))
      .sort((a, b) => b.percentage - a.percentage);
    const budgetTotals = budgetRows.reduce(
      (acc, r) => ({ budget: acc.budget + r.budget, actual: acc.actual + r.actual }),
      { budget: 0, actual: 0 }
    );

    // --- Net worth trend
    const prior = totalsByType(
      facets.priorFlows.map((r) => ({ type: r._id.type, currency: r._id.currency, amount: r.amount })),
      preferred,
      rates
    );
    const monthlyNet = new Map<string, number>();
    for (const row of facets.monthlyFlows) {
      const value = convert(row.amount, row._id.currency) * (row._id.type === "income" ? 1 : -1);
      monthlyNet.set(row._id.month, (monthlyNet.get(row._id.month) ?? 0) + value);
    }
    const monthKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit" });
    const openings = accountDocs
      .filter((a) => (a.openingBalance ?? 0) !== 0)
      .map((a) => {
        const parts = monthKeyFmt.formatToParts(a.createdAt);
        const y = parts.find((p) => p.type === "year")!.value;
        const m = parts.find((p) => p.type === "month")!.value;
        return { month: `${y}-${m}`, amount: convert(a.openingBalance, a.currency) };
      });
    const netWorthTrend = foldNetWorthTrend(months, monthlyNet, prior.income - prior.expenses, openings);

    const response = NextResponse.json({
      success: true,
      currency: preferred,
      isEstimate: Boolean(ratesData.isFallback),
      ratesUpdatedAt: ratesData.lastUpdated,
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      merchants,
      recurring,
      recurringWindow: { startDate: recurringStart.toISOString(), endDate: recurringEnd.toISOString() },
      currencies,
      budgets: {
        rows: budgetRows,
        totalBudget: roundToTwoDecimals(budgetTotals.budget),
        totalActual: roundToTwoDecimals(budgetTotals.actual),
      },
      netWorth: {
        current: balanceSheet.netWorth,
        assets: balanceSheet.assets,
        liabilities: balanceSheet.liabilities,
        unassignedBalance: balanceSheet.unassignedBalance,
        accounts: balanceSheet.accounts.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          currency: a.currency,
          color: a.color,
          isArchived: a.isArchived,
          balance: a.balance,
          convertedBalance: a.convertedBalance,
        })),
        trend: netWorthTrend,
      },
    });
    return withServerTiming(response, requestStartedAt, { data: dataDuration });
  } catch (error: unknown) {
    logError("reports.insights_failed", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate report insights" },
      { status: 500 }
    );
  }
}
