import { ExchangeRateService } from "@/lib/currency/exchangeRateService";
import type { SupportedCurrency } from "@/lib/currency/currencies";
import { roundToTwoDecimals } from "@/lib/utils";

export type TxType = "income" | "expense";

/** A server-side aggregated bucket: the raw sum of amounts of one type in one currency. */
export interface CurrencyBucket {
  type: TxType;
  currency: SupportedCurrency;
  amount: number;
}

/**
 * Convert each currency bucket into the target currency and total it per type.
 * Conversion happens once per currency (not per transaction), which avoids
 * accumulating per-row rounding error.
 */
export function totalsByType(
  buckets: CurrencyBucket[],
  target: SupportedCurrency,
  rates: Record<string, number>
): { income: number; expenses: number } {
  let income = 0;
  let expenses = 0;
  for (const bucket of buckets) {
    const converted = ExchangeRateService.convertWithSnapshot(
      bucket.amount,
      bucket.currency,
      target,
      rates
    );
    if (bucket.type === "income") income += converted;
    else expenses += converted;
  }
  return { income: roundToTwoDecimals(income), expenses: roundToTwoDecimals(expenses) };
}
