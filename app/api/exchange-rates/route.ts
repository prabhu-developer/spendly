import { NextResponse } from "next/server";
import { ExchangeRateService } from "@/lib/currency/exchangeRateService";
import { CURRENCY_LIST } from "@/lib/currency/currencies";

export async function GET() {
  try {
    const data = await ExchangeRateService.getExchangeRates();
    return NextResponse.json({
      success: true,
      base: data.base,
      rates: data.rates,
      lastUpdated: data.lastUpdated,
      isFallback: Boolean(data.isFallback),
      supportedCurrencies: CURRENCY_LIST,
    });
  } catch (error: any) {
    console.error("Exchange rates error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch exchange rates" },
      { status: 500 }
    );
  }
}
