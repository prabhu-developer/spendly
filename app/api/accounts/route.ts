import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireUser } from "@/lib/auth/guard";
import { enforceWriteRateLimit } from "@/lib/auth/rateLimiter";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Account } from "@/models/Account";
import { accountSchema } from "@/lib/validations/account";
import { getBalanceSheet } from "@/lib/accounts/balances";
import { ExchangeRateService } from "@/lib/currency/exchangeRateService";
import { withServerTiming } from "@/lib/api/performance";
import { recordAudit } from "@/lib/audit";
import { logError } from "@/lib/observability/logger";
import type { SupportedCurrency } from "@/lib/currency/currencies";

export const dynamic = "force-dynamic";

const MAX_ACCOUNTS_PER_USER = 50;

/** List accounts with live balances, plus net worth (balance sheet). */
export async function GET(req: NextRequest) {
  const startedAt = performance.now();
  try {
    const auth = await requireUser(req);
    if ("response" in auth) return auth.response;
    const { session } = auth;
    await connectToDatabase();
    const preferred: SupportedCurrency = session.preferredCurrency || "USD";
    const ratesData = await ExchangeRateService.getExchangeRates();
    const sheet = await getBalanceSheet(
      new mongoose.Types.ObjectId(session.userId),
      preferred,
      ratesData.rates
    );
    return withServerTiming(
      NextResponse.json({ success: true, ...sheet, isEstimate: Boolean(ratesData.isFallback) }),
      startedAt
    );
  } catch (error) {
    logError("accounts.list_failed", error);
    return NextResponse.json({ success: false, error: "Failed to load accounts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if ("response" in auth) return auth.response;
    const { session } = auth;
    const limited = await enforceWriteRateLimit(session.userId);
    if (limited) return limited;
    const body = await req.json().catch(() => null);
    const validation = accountSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0]?.message || "Invalid account data" },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const userId = new mongoose.Types.ObjectId(session.userId);
    const count = await Account.countDocuments({ userId });
    if (count >= MAX_ACCOUNTS_PER_USER) {
      return NextResponse.json(
        { success: false, error: `You can have up to ${MAX_ACCOUNTS_PER_USER} accounts` },
        { status: 400 }
      );
    }

    const account = await Account.create({ ...validation.data, userId });
    await recordAudit({ userId: session.userId, action: "account.create", entityId: account._id.toString(), req });

    return NextResponse.json(
      {
        success: true,
        account: {
          id: account._id.toString(),
          name: account.name,
          type: account.type,
          currency: account.currency,
          openingBalance: account.openingBalance,
          color: account.color,
          isArchived: account.isArchived,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logError("accounts.create_failed", error);
    return NextResponse.json({ success: false, error: "Failed to create account" }, { status: 500 });
  }
}
