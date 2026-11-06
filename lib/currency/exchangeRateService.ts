import { SupportedCurrency, SUPPORTED_CURRENCIES } from "./currencies";
import { roundToTwoDecimals } from "../utils";

export interface ExchangeRatesData {
  base: string;
  rates: Record<string, number>;
  lastUpdated: string;
  isFallback?: boolean;
}

export interface ConversionResult {
  originalAmount: number;
  originalCurrency: SupportedCurrency;
  convertedAmount: number;
  targetCurrency: SupportedCurrency;
  exchangeRate: number;
  rateDate: string;
  isEstimate: boolean;
}

// In-memory cache for server-side exchange rates
let cachedRates: ExchangeRatesData | null = null;
let cacheExpiry: number = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Safe baseline rates (calibrated to realistic market values) in case of external network outage
const BACKUP_RATES_USD_BASE: Record<string, number> = {
  USD: 1,
  INR: 84.25,
  EUR: 0.92,
  GBP: 0.78,
  AED: 3.6725,
  SGD: 1.32,
  CAD: 1.38,
  AUD: 1.51,
  JPY: 152.4,
  SAR: 3.75,
};

export class ExchangeRateService {
  /**
   * Fetch exchange rates against USD base with caching and failover
   */
  public static async getExchangeRates(): Promise<ExchangeRatesData> {
    const now = Date.now();
    if (cachedRates && now < cacheExpiry) {
      return cachedRates;
    }

    try {
      const apiKey = process.env.EXCHANGE_RATE_API_KEY;
      const url = apiKey
        ? `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`
        : `https://open.er-api.com/v6/latest/USD`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Exchange rate provider returned status ${response.status}`);
      }

      const data = await response.json();
      if (data && (data.rates || data.conversion_rates)) {
        const rates = data.rates || data.conversion_rates;
        cachedRates = {
          base: "USD",
          rates,
          lastUpdated: new Date().toISOString(),
          isFallback: false,
        };
        cacheExpiry = now + CACHE_TTL_MS;
        return cachedRates;
      }
      throw new Error("Invalid rate response structure");
    } catch (error) {
      // Return cached if available, else backup
      if (cachedRates) {
        return { ...cachedRates, isFallback: true };
      }

      return {
        base: "USD",
        rates: BACKUP_RATES_USD_BASE,
        lastUpdated: new Date().toISOString(),
        isFallback: true,
      };
    }
  }

  /**
   * Convert an amount from fromCurrency to toCurrency
   */
  public static async convert(
    amount: number,
    fromCurrency: SupportedCurrency | string,
    toCurrency: SupportedCurrency | string
  ): Promise<ConversionResult> {
    const from = (fromCurrency in SUPPORTED_CURRENCIES ? fromCurrency : "USD") as SupportedCurrency;
    const to = (toCurrency in SUPPORTED_CURRENCIES ? toCurrency : "USD") as SupportedCurrency;

    if (from === to) {
      return {
        originalAmount: amount,
        originalCurrency: from,
        convertedAmount: roundToTwoDecimals(amount),
        targetCurrency: to,
        exchangeRate: 1,
        rateDate: new Date().toISOString(),
        isEstimate: false,
      };
    }

    const { rates, lastUpdated, isFallback } = await this.getExchangeRates();
    const rateFrom = rates[from] || 1;
    const rateTo = rates[to] || 1;

    // Convert from 'from' to USD, then USD to 'to'
    const crossRate = rateTo / rateFrom;
    const converted = roundToTwoDecimals(amount * crossRate);

    return {
      originalAmount: amount,
      originalCurrency: from,
      convertedAmount: converted,
      targetCurrency: to,
      exchangeRate: roundToTwoDecimals(crossRate),
      rateDate: lastUpdated,
      isEstimate: Boolean(isFallback),
    };
  }

  /**
   * Synchronous helper using known rates snapshot
   */
  public static convertWithSnapshot(
    amount: number,
    from: SupportedCurrency,
    to: SupportedCurrency,
    rates: Record<string, number>
  ): number {
    if (from === to) return amount;
    const rateFrom = rates[from] || 1;
    const rateTo = rates[to] || 1;
    const crossRate = rateTo / rateFrom;
    return roundToTwoDecimals(amount * crossRate);
  }
}
