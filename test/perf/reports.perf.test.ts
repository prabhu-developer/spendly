// Performance comparison: legacy (pre-upgrade) algorithms vs current, on a 20k-transaction user.
// Run with: npm run test:perf
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { subMonths, startOfMonth, endOfMonth, format } from "date-fns";
import { call, createUser, startDb, stopDb, type TestUser } from "../integration/helpers";
import * as reports from "@/app/api/reports/route";
import * as budgets from "@/app/api/budgets/route";
import * as transactions from "@/app/api/transactions/route";
import { Transaction } from "@/models/Transaction";
import { Category } from "@/models/Category";
import { Budget } from "@/models/Budget";
import { ExchangeRateService } from "@/lib/currency/exchangeRateService";

const N = 20_000;
let user: TestUser;
let categoryIds: mongoose.Types.ObjectId[] = [];
const results: Record<string, unknown>[] = [];

async function median(fn: () => Promise<unknown>, runs = 7) {
  await fn(); // warm-up
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    await fn();
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
}

/** The reports algorithm as it was before the upgrade (find + populate + JS loop). */
async function legacyReport(userId: mongoose.Types.ObjectId) {
  const now = new Date();
  const start = startOfMonth(now);
  const end = endOfMonth(now);
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - (end.getTime() - start.getTime()));
  const sixMonthsAgo = startOfMonth(subMonths(now, 5));
  const rates = (await ExchangeRateService.getExchangeRates()).rates;
  const txs = await Transaction.find({ userId, date: { $gte: prevStart < sixMonthsAgo ? prevStart : sixMonthsAgo, $lte: end } })
    .select("amount currency type date categoryId")
    .populate("categoryId", "name color")
    .lean();
  let income = 0;
  const trend = new Map<string, number>();
  for (const t of txs) {
    const c = ExchangeRateService.convertWithSnapshot(t.amount, t.currency, "USD", rates);
    if (t.date >= start && t.type === "income") income += c;
    const k = format(t.date, "MMM yyyy");
    trend.set(k, (trend.get(k) ?? 0) + c);
  }
  return { income, docs: txs.length };
}

/** The budgets algorithm as it was before the upgrade (load every expense of the month). */
async function legacyBudgets(userId: mongoose.Types.ObjectId, month: number, year: number) {
  const list = await Budget.find({ userId, month, year }).populate("categoryId", "name icon color type");
  const expenses = await Transaction.find({
    userId,
    type: "expense",
    date: { $gte: new Date(year, month - 1, 1), $lte: new Date(year, month, 0, 23, 59, 59, 999) },
  }).lean();
  return { budgets: list.length, docs: expenses.length };
}

beforeAll(async () => {
  await startDb();
  user = await createUser("perf@example.com", "USD");
  const cats = await Category.insertMany(
    Array.from({ length: 12 }, (_, i) => ({ userId: user.objectId, name: `Cat ${i}`, type: i < 2 ? "income" : "expense" }))
  );
  categoryIds = cats.map((c) => c._id);
  const now = new Date();
  const currencies = ["USD", "USD", "USD", "INR", "EUR"] as const;
  const docs = Array.from({ length: N }, (_, i) => {
    const income = i % 10 === 0;
    return {
      userId: user.objectId,
      title: `Merchant ${i % 300}`,
      amount: Math.round((5 + ((i * 7919) % 50000) / 100) * 100) / 100,
      currency: currencies[i % currencies.length],
      type: income ? "income" : "expense",
      categoryId: income ? categoryIds[i % 2] : categoryIds[2 + (i % 10)],
      date: new Date(now.getTime() - ((i * 37) % (730 * 24)) * 3600_000),
      paymentMethod: "Other",
    };
  });
  for (let i = 0; i < docs.length; i += 5000) await Transaction.insertMany(docs.slice(i, i + 5000), { lean: true });
  await Budget.insertMany(
    categoryIds.slice(2, 8).map((categoryId) => ({
      userId: user.objectId,
      categoryId,
      amount: 500,
      currency: "USD",
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    }))
  );
}, 300_000);

afterAll(async () => {
  // eslint-disable-next-line no-console
  console.table(results);
  await stopDb();
});

describe(`performance with ${N.toLocaleString()} transactions`, () => {
  it("reports: aggregation vs legacy load-everything", async () => {
    const legacy = await legacyReport(user.objectId);
    const legacyMs = await median(() => legacyReport(user.objectId));
    const currentMs = await median(() => call(reports.GET, { path: "/api/reports?includeBalance=true", user }));
    results.push({
      case: "GET /api/reports (dashboard)",
      legacyMs: legacyMs.toFixed(1),
      currentMs: currentMs.toFixed(1),
      speedup: (legacyMs / currentMs).toFixed(1) + "×",
      legacyDocsToNode: legacy.docs,
    });
    expect(currentMs).toBeLessThan(legacyMs);
  }, 120_000);

  it("budgets: aggregation vs legacy load-every-expense", async () => {
    const now = new Date();
    const m = now.getMonth() + 1;
    const y = now.getFullYear();
    const legacy = await legacyBudgets(user.objectId, m, y);
    const legacyMs = await median(() => legacyBudgets(user.objectId, m, y));
    const currentMs = await median(() => call(budgets.GET, { path: `/api/budgets?month=${m}&year=${y}`, user }));
    results.push({
      case: "GET /api/budgets",
      legacyMs: legacyMs.toFixed(1),
      currentMs: currentMs.toFixed(1),
      speedup: (legacyMs / currentMs).toFixed(1) + "×",
      legacyDocsToNode: legacy.docs,
    });
  }, 120_000);

  it("category-filtered list uses the compound index (no in-memory sort)", async () => {
    const filter = { userId: user.objectId, categoryId: categoryIds[3] };
    // Legacy index for comparison
    await Transaction.collection.createIndex({ userId: 1, categoryId: 1 }, { name: "legacy_user_category" });
    const legacyPlan = await Transaction.find(filter).sort({ date: -1, _id: -1 }).limit(25).hint("legacy_user_category").explain("executionStats");
    const currentPlan = await Transaction.find(filter).sort({ date: -1, _id: -1 }).limit(25).hint({ userId: 1, categoryId: 1, date: -1, _id: -1 }).explain("executionStats");
    await Transaction.collection.dropIndex("legacy_user_category");
    type Plan = { executionStats: { totalDocsExamined: number; executionTimeMillis: number } };
    const l = (legacyPlan as unknown as Plan).executionStats;
    const c = (currentPlan as unknown as Plan).executionStats;
    results.push({
      case: "Category filter, page 1 (docs examined)",
      legacyMs: `${l.totalDocsExamined} docs`,
      currentMs: `${c.totalDocsExamined} docs`,
      speedup: (l.totalDocsExamined / Math.max(1, c.totalDocsExamined)).toFixed(1) + "×",
      legacyDocsToNode: "-",
    });
    expect(c.totalDocsExamined).toBeLessThanOrEqual(25);

    // Unfiltered newest-first page (the default Transactions view)
    const defaultPlan = (await Transaction.find({ userId: user.objectId })
      .sort({ date: -1, _id: -1 })
      .limit(25)
      .explain("executionStats")) as unknown as Plan;
    results.push({
      case: "Default list page (docs examined)",
      legacyMs: "-",
      currentMs: `${defaultPlan.executionStats.totalDocsExamined} docs`,
      speedup: "-",
      legacyDocsToNode: "-",
    });
    expect(defaultPlan.executionStats.totalDocsExamined).toBeLessThanOrEqual(25);

    const listMs = await median(() =>
      call(transactions.GET, { path: `/api/transactions?categoryId=${categoryIds[3]}&limit=25`, user })
    );
    results.push({ case: "GET /api/transactions (filtered page)", legacyMs: "-", currentMs: listMs.toFixed(1), speedup: "-", legacyDocsToNode: "-" });
  }, 120_000);
});
