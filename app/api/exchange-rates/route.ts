import { NextResponse } from "next/server";
import { ExchangeRateService } from "@/lib/currency/exchangeRateService";
import { CURRENCY_LIST } from "@/lib/currency/currencies";
import { internalError } from "@/lib/auth/guard";

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
  } catch (error) {
    return internalError("exchange_rates_error", error, "Failed to fetch exchange rates", {
      route: "/api/exchange-rates",
    });
  }
}
