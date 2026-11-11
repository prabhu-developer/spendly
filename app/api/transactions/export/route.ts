import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { requireUser } from "@/lib/auth/guard";
import { checkRateLimitShared, rateLimitResponse } from "@/lib/auth/rateLimiter";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Transaction } from "@/models/Transaction";
import { buildTransactionQuery, parseTransactionFilters } from "@/lib/transactions/filters";
import { escapeCsvCell } from "@/lib/reports/csv";
import { recordAudit } from "@/lib/audit";
import { logError } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

const MAX_EXPORT_ROWS = 50_000;
const HEADERS = ["Date", "Title", "Type", "Amount", "Signed amount", "Currency", "Category", "Account", "Payment method", "Notes"];

/**
 * Stream the filtered transactions as CSV (opens in Excel via UTF-8 BOM).
 * Rows are streamed from a cursor so large exports never sit fully in memory.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if ("response" in auth) return auth.response;
    const { session, userObjectId } = auth;

    const limit = await checkRateLimitShared(`export:${session.userId}`, { limit: 10, windowMs: 60_000 });
    if (!limit.allowed) return rateLimitResponse(limit, "Too many exports. Please wait a moment.");

    const { searchParams } = new URL(req.url);
    const parsed = parseTransactionFilters(searchParams);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }

    await connectToDatabase();
    const query = buildTransactionQuery(userObjectId, parsed.filters);
    const cursor = Transaction.find(query)
      .select("title amount currency type date categoryId accountId paymentMethod notes")
      .populate("categoryId", "name")
      .populate("accountId", "name")
      .sort({ date: -1, _id: -1 })
      .limit(MAX_EXPORT_ROWS)
      .lean()
      .cursor();

    await recordAudit({
      userId: session.userId,
      action: "transaction.export",
      metadata: { filters: parsed.filters },
      req,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode("﻿" + HEADERS.join(",") + "\r\n"));
        try {
          let batch: string[] = [];
          for await (const t of cursor) {
            const tx = t as unknown as {
              date: Date; title: string; type: string; amount: number; currency: string;
              categoryId?: { name?: string } | null; accountId?: { name?: string } | null;
              paymentMethod?: string; notes?: string;
            };
            batch.push(
              [
                format(new Date(tx.date), "yyyy-MM-dd"),
                tx.title,
                tx.type,
                tx.amount,
                tx.type === "expense" ? -tx.amount : tx.amount,
                tx.currency,
                tx.categoryId?.name ?? "Uncategorized",
                tx.accountId?.name ?? "",
                tx.paymentMethod ?? "",
                tx.notes ?? "",
              ]
                .map(escapeCsvCell)
                .join(",")
            );
            if (batch.length >= 500) {
              controller.enqueue(encoder.encode(batch.join("\r\n") + "\r\n"));
              batch = [];
            }
          }
          if (batch.length) controller.enqueue(encoder.encode(batch.join("\r\n") + "\r\n"));
          controller.close();
        } catch (error) {
          logError("transactions.export_stream_failed", error);
          controller.error(error);
        }
      },
      cancel() {
        void cursor.close();
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="spendly-transactions-${format(new Date(), "yyyy-MM-dd")}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    logError("transactions.export_failed", error);
    return NextResponse.json({ success: false, error: "Export failed" }, { status: 500 });
  }
}
