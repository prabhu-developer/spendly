import mongoose from "mongoose";
import { Account, type AccountType } from "@/models/Account";
import { Transaction } from "@/models/Transaction";
import { ExchangeRateService } from "@/lib/currency/exchangeRateService";
import type { SupportedCurrency } from "@/lib/currency/currencies";
import { roundToTwoDecimals } from "@/lib/utils";

export interface AccountFlowRow {
  accountId: string | null;
  type: "income" | "expense";
  currency: SupportedCurrency;
  amount: number;
}

export interface AccountLike {
  id: string;
  name: string;
  type: AccountType;
  currency: SupportedCurrency;
  openingBalance: number;
  color: string;
  isArchived: boolean;
}

export interface AccountWithBalance extends AccountLike {
  /** Balance in the account's own currency */
  balance: number;
  /** Balance converted to the user's preferred currency */
  convertedBalance: number;
  transactionCount?: number;
}

export interface BalanceSheet {
  accounts: AccountWithBalance[];
  /** Net flow of transactions not linked to any account (legacy data), preferred currency */
  unassignedBalance: number;
  /** Σ account balances + unassigned flows, preferred currency */
  netWorth: number;
  assets: number;
  liabilities: number;
  currency: SupportedCurrency;
}

/**
 * Pure fold of account opening balances + aggregated flows into a balance sheet.
 * Net worth with no accounts equals the all-time income − expense balance.
 */
export function foldBalanceSheet(
  accounts: AccountLike[],
  rows: AccountFlowRow[],
  preferred: SupportedCurrency,
  rates: Record<string, number>
): BalanceSheet {
  const convert = (amount: number, from: SupportedCurrency, to: SupportedCurrency) =>
    from === to ? amount : ExchangeRateService.convertWithSnapshot(amount, from, to, rates);

  const byId = new Map(accounts.map((a) => [a.id, { ...a, balance: a.openingBalance }]));
  let unassigned = 0;

  for (const row of rows) {
    const signed = row.type === "income" ? row.amount : -row.amount;
    const account = row.accountId ? byId.get(row.accountId) : undefined;
    if (account) {
      account.balance += convert(signed, row.currency, account.currency);
    } else {
      // Unknown/deleted account ids fall back to unassigned so totals stay consistent
      unassigned += convert(signed, row.currency, preferred);
    }
  }

  let assets = 0;
  let liabilities = 0;
  const result: AccountWithBalance[] = [];
  for (const account of byId.values()) {
    const balance = roundToTwoDecimals(account.balance);
    const convertedBalance = roundToTwoDecimals(convert(balance, account.currency, preferred));
    if (convertedBalance >= 0) assets += convertedBalance;
    else liabilities += -convertedBalance;
    result.push({ ...account, balance, convertedBalance });
  }

  const unassignedBalance = roundToTwoDecimals(unassigned);
  if (unassignedBalance >= 0) assets += unassignedBalance;
  else liabilities += -unassignedBalance;

  return {
    accounts: result,
    unassignedBalance,
    netWorth: roundToTwoDecimals(assets - liabilities),
    assets: roundToTwoDecimals(assets),
    liabilities: roundToTwoDecimals(liabilities),
    currency: preferred,
  };
}

/** Load accounts + aggregated flows for a user and build the balance sheet. */
export async function getBalanceSheet(
  userId: mongoose.Types.ObjectId,
  preferred: SupportedCurrency,
  rates: Record<string, number>
): Promise<BalanceSheet> {
  const [accountDocs, flowRows] = await Promise.all([
    Account.find({ userId }).sort({ isArchived: 1, name: 1 }).lean(),
    Transaction.aggregate<{
      _id: { accountId: mongoose.Types.ObjectId | null; type: "income" | "expense"; currency: SupportedCurrency };
      amount: number;
    }>([
      { $match: { userId } },
      {
        $group: {
          _id: { accountId: { $ifNull: ["$accountId", null] }, type: "$type", currency: "$currency" },
          amount: { $sum: "$amount" },
        },
      },
    ]),
  ]);

  return foldBalanceSheet(
    accountDocs.map((a) => ({
      id: a._id.toString(),
      name: a.name,
      type: a.type,
      currency: a.currency,
      openingBalance: a.openingBalance ?? 0,
      color: a.color,
      isArchived: a.isArchived,
    })),
    flowRows.map((r) => ({
      accountId: r._id.accountId ? r._id.accountId.toString() : null,
      type: r._id.type,
      currency: r._id.currency,
      amount: r.amount,
    })),
    preferred,
    rates
  );
}
