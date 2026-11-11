// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { call, clearDb, createUser, startDb, stopDb, type TestUser } from "./helpers";

import * as transactions from "@/app/api/transactions/route";
import * as transactionById from "@/app/api/transactions/[id]/route";
import * as bulk from "@/app/api/transactions/bulk/route";
import * as exportRoute from "@/app/api/transactions/export/route";
import * as accounts from "@/app/api/accounts/route";
import * as accountById from "@/app/api/accounts/[id]/route";
import * as reports from "@/app/api/reports/route";
import * as insights from "@/app/api/reports/insights/route";
import * as budgets from "@/app/api/budgets/route";
import { Category } from "@/models/Category";
import { Transaction } from "@/models/Transaction";

// Fallback FX rates used when the provider is unreachable (see ExchangeRateService)
const INR_PER_USD = 84.25;

let alice: TestUser;
let bob: TestUser;
let food: string;
let rent: string;
let salary: string;

async function addCategory(user: TestUser, name: string, type: "income" | "expense") {
  const c = await Category.create({ userId: user.objectId, name, type });
  return c._id.toString();
}

async function addTx(user: TestUser, body: Record<string, unknown>) {
  const res = await call(transactions.POST, {
    method: "POST",
    path: "/api/transactions",
    user,
    body: { paymentMethod: "Other", notes: "", currency: "USD", ...body },
  });
  expect(res.status, JSON.stringify(res.data)).toBeLessThan(300);
  return res.data.transaction as { id: string; currency: string };
}

beforeAll(async () => {
  await startDb();
}, 120_000);

afterAll(async () => {
  await stopDb();
});

beforeEach(async () => {
  await clearDb();
  alice = await createUser("alice@example.com", "USD");
  bob = await createUser("bob@example.com", "USD");
  food = await addCategory(alice, "Food", "expense");
  rent = await addCategory(alice, "Rent", "expense");
  salary = await addCategory(alice, "Salary", "income");
});

describe("transactions API", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await call(transactions.GET, { path: "/api/transactions" });
    expect(res.status).toBe(401);
  });

  it("isolates tenants: other users can't read, edit or delete", async () => {
    const tx = await addTx(alice, { title: "Lunch", amount: 12, type: "expense", categoryId: food, date: "2026-11-02" });

    const list = await call(transactions.GET, { path: "/api/transactions", user: bob });
    expect(list.data.transactions).toHaveLength(0);

    const get = await call(transactionById.GET, { path: `/api/transactions/${tx.id}`, user: bob, params: { id: tx.id } });
    expect(get.status).toBe(404);

    const del = await call(transactionById.DELETE, {
      method: "DELETE",
      path: `/api/transactions/${tx.id}`,
      user: bob,
      params: { id: tx.id },
    });
    expect(del.status).toBe(404);
    expect(await Transaction.countDocuments()).toBe(1);

    // Bob can't use Alice's category either
    const steal = await call(transactions.POST, {
      method: "POST",
      path: "/api/transactions",
      user: bob,
      body: { title: "x", amount: 1, type: "expense", categoryId: food, date: "2026-11-02", currency: "USD" },
    });
    expect(steal.status).toBe(400);
  });

  it("treats search input literally (no regex injection)", async () => {
    await addTx(alice, { title: "Coffee (Starbucks)", amount: 5, type: "expense", categoryId: food, date: "2026-11-02" });
    await addTx(alice, { title: "Coffee shop", amount: 4, type: "expense", categoryId: food, date: "2026-11-02" });

    const res = await call(transactions.GET, { path: "/api/transactions?search=" + encodeURIComponent("(Starbucks)"), user: alice });
    expect(res.status).toBe(200);
    expect(res.data.transactions.map((t: { title: string }) => t.title)).toEqual(["Coffee (Starbucks)"]);

    const evil = await call(transactions.GET, { path: "/api/transactions?search=" + encodeURIComponent("(a+)+$"), user: alice });
    expect(evil.status).toBe(200);
    expect(evil.data.transactions).toHaveLength(0);
  });

  it("filters by amount range, account and validates bad filters", async () => {
    await addTx(alice, { title: "Small", amount: 5, type: "expense", categoryId: food, date: "2026-11-02" });
    await addTx(alice, { title: "Big", amount: 500, type: "expense", categoryId: rent, date: "2026-11-03" });

    const ranged = await call(transactions.GET, { path: "/api/transactions?minAmount=10&maxAmount=1000", user: alice });
    expect(ranged.data.transactions.map((t: { title: string }) => t.title)).toEqual(["Big"]);

    const unassigned = await call(transactions.GET, { path: "/api/transactions?accountId=unassigned", user: alice });
    expect(unassigned.data.pagination.total).toBe(2);

    const bad = await call(transactions.GET, { path: "/api/transactions?minAmount=50&maxAmount=10", user: alice });
    expect(bad.status).toBe(400);
    const badDate = await call(transactions.GET, { path: "/api/transactions?startDate=not-a-date", user: alice });
    expect(badDate.status).toBe(400);
  });

  it("is idempotent for offline drafts (clientRequestId)", async () => {
    const body = {
      title: "Taxi",
      amount: 20,
      type: "expense",
      categoryId: food,
      date: "2026-11-04",
      currency: "USD",
      paymentMethod: "Cash",
      clientRequestId: "draft-123456",
    };
    const first = await call(transactions.POST, { method: "POST", path: "/api/transactions", user: alice, body });
    const second = await call(transactions.POST, { method: "POST", path: "/api/transactions", user: alice, body });
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.data.duplicate).toBe(true);
    expect(second.data.transaction.id).toBe(first.data.transaction.id);
    expect(await Transaction.countDocuments({ userId: alice.objectId })).toBe(1);

    // Same key from another user is a different transaction
    const bobFood = await addCategory(bob, "Food", "expense");
    const bobRes = await call(transactions.POST, {
      method: "POST",
      path: "/api/transactions",
      user: bob,
      body: { ...body, categoryId: bobFood },
    });
    expect(bobRes.status).toBe(201);
  });

  it("refreshes the FX snapshot when currency changes on edit", async () => {
    const tx = await addTx(alice, { title: "Hotel", amount: 100, type: "expense", categoryId: food, date: "2026-11-05" });
    await Transaction.updateOne({ _id: tx.id }, { $set: { "exchangeRateSnapshot.rateToUSD": 999 } });
    const res = await call(transactionById.PUT, {
      method: "PUT",
      path: `/api/transactions/${tx.id}`,
      user: alice,
      params: { id: tx.id },
      body: { title: "Hotel", amount: 8425, currency: "INR", type: "expense", categoryId: food, date: "2026-11-05", paymentMethod: "Other" },
    });
    expect(res.status).toBe(200);
    const saved = await Transaction.findById(tx.id).lean();
    expect(saved!.currency).toBe("INR");
    expect(saved!.exchangeRateSnapshot!.rateToUSD).toBe(INR_PER_USD);
  });
});

describe("accounts & net worth", () => {
  it("records account transactions in the account currency and computes balances", async () => {
    const created = await call(accounts.POST, {
      method: "POST",
      path: "/api/accounts",
      user: alice,
      body: { name: "HDFC", type: "savings", currency: "INR", openingBalance: 84250 },
    });
    expect(created.status).toBe(201);
    const accountId = created.data.account.id;

    const tx = await addTx(alice, { title: "Groceries", amount: 8425, type: "expense", categoryId: food, date: "2026-11-02", accountId });
    expect(tx.currency).toBe("INR");
    await addTx(alice, { title: "Bonus", amount: 100, type: "income", categoryId: salary, date: "2026-11-02" }); // unassigned USD

    const sheet = await call(accounts.GET, { path: "/api/accounts", user: alice });
    expect(sheet.status).toBe(200);
    const account = sheet.data.accounts[0];
    expect(account.balance).toBe(75825); // 84250 − 8425 INR
    expect(account.convertedBalance).toBe(900); // 75825 / 84.25
    expect(sheet.data.unassignedBalance).toBe(100);
    expect(sheet.data.netWorth).toBe(1000);

    // Bob sees none of it
    const bobSheet = await call(accounts.GET, { path: "/api/accounts", user: bob });
    expect(bobSheet.data.accounts).toHaveLength(0);
    expect(bobSheet.data.netWorth).toBe(0);
  });

  it("deleting an account keeps its transactions (unassigned) and net worth flows", async () => {
    const created = await call(accounts.POST, {
      method: "POST",
      path: "/api/accounts",
      user: alice,
      body: { name: "Wallet", type: "cash", currency: "USD", openingBalance: 0 },
    });
    const accountId = created.data.account.id;
    await addTx(alice, { title: "Snacks", amount: 30, type: "expense", categoryId: food, date: "2026-11-02", accountId });

    const del = await call(accountById.DELETE, {
      method: "DELETE",
      path: `/api/accounts/${accountId}`,
      user: alice,
      params: { id: accountId },
    });
    expect(del.status).toBe(200);
    expect(del.data.unassignedTransactions).toBe(1);
    expect(await Transaction.countDocuments({ userId: alice.objectId })).toBe(1);

    const sheet = await call(accounts.GET, { path: "/api/accounts", user: alice });
    expect(sheet.data.netWorth).toBe(-30);
  });

  it("blocks currency changes once transactions are linked", async () => {
    const created = await call(accounts.POST, {
      method: "POST",
      path: "/api/accounts",
      user: alice,
      body: { name: "Card", type: "credit_card", currency: "USD", openingBalance: -500 },
    });
    const accountId = created.data.account.id;
    await addTx(alice, { title: "Dinner", amount: 50, type: "expense", categoryId: food, date: "2026-11-02", accountId });
    const res = await call(accountById.PUT, {
      method: "PUT",
      path: `/api/accounts/${accountId}`,
      user: alice,
      params: { id: accountId },
      body: { name: "Card", type: "credit_card", currency: "EUR", openingBalance: -500 },
    });
    expect(res.status).toBe(400);
  });
});

describe("bulk actions", () => {
  it("only touches the caller's transactions and skips type mismatches", async () => {
    const a1 = await addTx(alice, { title: "A1", amount: 1, type: "expense", categoryId: food, date: "2026-11-01" });
    const a2 = await addTx(alice, { title: "A2", amount: 2, type: "income", categoryId: salary, date: "2026-11-01" });
    const bobFood = await addCategory(bob, "Food", "expense");
    const b1 = await addTx(bob, { title: "B1", amount: 3, type: "expense", categoryId: bobFood, date: "2026-11-01" });

    const categorize = await call(bulk.POST, {
      method: "POST",
      path: "/api/transactions/bulk",
      user: alice,
      body: { action: "categorize", ids: [a1.id, a2.id, b1.id], categoryId: rent },
    });
    expect(categorize.data.affected).toBe(1); // a2 is income, b1 is Bob's
    expect((await Transaction.findById(a1.id).lean())!.categoryId.toString()).toBe(rent);
    expect((await Transaction.findById(b1.id).lean())!.categoryId.toString()).toBe(bobFood);

    const del = await call(bulk.POST, {
      method: "POST",
      path: "/api/transactions/bulk",
      user: alice,
      body: { action: "delete", ids: [a1.id, b1.id] },
    });
    expect(del.data.affected).toBe(1);
    expect(await Transaction.exists({ _id: b1.id })).toBeTruthy();

    const invalid = await call(bulk.POST, {
      method: "POST",
      path: "/api/transactions/bulk",
      user: alice,
      body: { action: "delete", ids: [] },
    });
    expect(invalid.status).toBe(400);
  });
});

describe("reports accuracy", () => {
  beforeEach(async () => {
    // October (previous period) and November (current period)
    await addTx(alice, { title: "Oct salary", amount: 4000, type: "income", categoryId: salary, date: "2026-10-01" });
    await addTx(alice, { title: "Oct rent", amount: 1500, type: "expense", categoryId: rent, date: "2026-10-03" });
    await addTx(alice, { title: "Nov salary", amount: 5000, type: "income", categoryId: salary, date: "2026-11-01" });
    await addTx(alice, { title: "Nov rent", amount: 1500, type: "expense", categoryId: rent, date: "2026-11-03" });
    await addTx(alice, { title: "Nov food", amount: 300.1, type: "expense", categoryId: food, date: "2026-11-05" });
    await addTx(alice, { title: "Nov food INR", amount: 8425, currency: "INR", type: "expense", categoryId: food, date: "2026-11-06" });
    // Edge: last moment of the period is included, first moment of next excluded
    await addTx(alice, { title: "Nov 30", amount: 0.2, type: "expense", categoryId: food, date: "2026-11-30T23:59:59" });
    await addTx(alice, { title: "Dec 1", amount: 999, type: "expense", categoryId: food, date: "2026-12-01T00:00:00" });
    // POST records the preferred currency (USD) unless an account is chosen; make this one INR
    await Transaction.updateOne({ title: "Nov food INR" }, { $set: { currency: "INR" } });
  });

  it("totals, category breakdown and previous period reconcile", async () => {
    const res = await call(reports.GET, { path: "/api/reports?startDate=2026-11-01&endDate=2026-11-30", user: alice });
    expect(res.status).toBe(200);
    const { summary, categoryBreakdown } = res.data;

    // 1500 + 300.1 + 100 (8425 INR) + 0.2
    expect(summary.totalExpenses).toBe(1900.3);
    expect(summary.totalIncome).toBe(5000);
    expect(summary.totalSavings).toBe(3099.7);
    expect(summary.savingsRate).toBe(62);
    // Previous period is all of October (incl. Oct 1 salary): income 4000, expenses 1500
    expect(summary.incomeChange).toBe(25);
    expect(summary.expensesChange).toBeCloseTo(26.69, 2);

    const breakdownTotal = categoryBreakdown.reduce((s: number, c: { amount: number }) => s + c.amount, 0);
    expect(breakdownTotal).toBeCloseTo(summary.totalExpenses, 2);
    const pctTotal = categoryBreakdown.reduce((s: number, c: { percentage: number }) => s + c.percentage, 0);
    expect(pctTotal).toBeCloseTo(100, 0);
    expect(categoryBreakdown[0]).toMatchObject({ name: "Rent", amount: 1500 });

    if (res.data.cashFlow) {
      const flowExpenses = res.data.cashFlow.reduce((s: number, m: { expenses: number }) => s + m.expenses, 0);
      expect(flowExpenses).toBeCloseTo(summary.totalExpenses, 2);
    }
  });

  it("insights endpoint returns merchants and a consistent net worth", async () => {
    const res = await call(insights.GET, {
      path: "/api/reports/insights?startDate=2026-11-01&endDate=2026-11-30",
      user: alice,
    });
    expect(res.status).toBe(200);
    expect(res.data.merchants.length).toBeGreaterThan(0);
    expect(res.data.merchants[0].title.toLowerCase()).toContain("rent");
    expect(typeof res.data.netWorth.current).toBe("number");
  });

  it("rejects invalid ranges", async () => {
    const res = await call(reports.GET, { path: "/api/reports?startDate=2026-12-01&endDate=2026-11-01", user: alice });
    expect(res.status).toBe(400);
  });
});

describe("budgets", () => {
  it("computes spent per budgeted category in MongoDB", async () => {
    const { Budget } = await import("@/models/Budget");
    await Budget.create({ userId: alice.objectId, categoryId: new mongoose.Types.ObjectId(food), amount: 400, currency: "USD", month: 11, year: 2026 });
    await addTx(alice, { title: "Food 1", amount: 250, type: "expense", categoryId: food, date: "2026-11-02" });
    await addTx(alice, { title: "Food 2", amount: 200, type: "expense", categoryId: food, date: "2026-11-20" });
    await addTx(alice, { title: "Food Oct", amount: 999, type: "expense", categoryId: food, date: "2026-10-20" });

    const res = await call(budgets.GET, { path: "/api/budgets?month=11&year=2026", user: alice });
    expect(res.status).toBe(200);
    expect(res.data.budgets[0]).toMatchObject({ spent: 450, amount: 400, isExceeded: true, percentage: 113 });
    expect(res.data.summary.totalRemaining).toBe(0);
  });
});

describe("CSV export", () => {
  it("streams only the caller's filtered rows with formula-injection protection", async () => {
    await addTx(alice, { title: "=HYPERLINK(\"http://x\")", amount: 10, type: "expense", categoryId: food, date: "2026-11-02" });
    await addTx(alice, { title: "Salary, Nov", amount: 5000, type: "income", categoryId: salary, date: "2026-11-01" });
    const bobFood = await addCategory(bob, "Food", "expense");
    await addTx(bob, { title: "Bob secret", amount: 1, type: "expense", categoryId: bobFood, date: "2026-11-02" });

    const res = await call(exportRoute.GET, { path: "/api/transactions/export?type=expense", user: alice });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("attachment");
    const csv = res.data as string;
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(2); // header + 1 expense
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).not.toContain("Bob secret");
    expect(csv).not.toContain("Salary");
  });
});
