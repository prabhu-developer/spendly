export type SupportedCurrency =
  | "INR"
  | "USD"
  | "EUR"
  | "GBP"
  | "AED"
  | "SGD"
  | "CAD"
  | "AUD"
  | "JPY"
  | "SAR";

export interface CurrencyConfig {
  code: SupportedCurrency;
  name: string;
  symbol: string;
  locale: string;
  decimals: number;
}

export const SUPPORTED_CURRENCIES: Record<SupportedCurrency, CurrencyConfig> = {
  INR: { code: "INR", name: "Indian Rupee", symbol: "₹", locale: "en-IN", decimals: 2 },
  USD: { code: "USD", name: "US Dollar", symbol: "$", locale: "en-US", decimals: 2 },
  EUR: { code: "EUR", name: "Euro", symbol: "€", locale: "de-DE", decimals: 2 },
  GBP: { code: "GBP", name: "British Pound", symbol: "£", locale: "en-GB", decimals: 2 },
  AED: { code: "AED", name: "UAE Dirham", symbol: "د.إ", locale: "ar-AE", decimals: 2 },
  SGD: { code: "SGD", name: "Singapore Dollar", symbol: "S$", locale: "en-SG", decimals: 2 },
  CAD: { code: "CAD", name: "Canadian Dollar", symbol: "CA$", locale: "en-CA", decimals: 2 },
  AUD: { code: "AUD", name: "Australian Dollar", symbol: "A$", locale: "en-AU", decimals: 2 },
  JPY: { code: "JPY", name: "Japanese Yen", symbol: "¥", locale: "ja-JP", decimals: 0 },
  SAR: { code: "SAR", name: "Saudi Riyal", symbol: "﷼", locale: "ar-SA", decimals: 2 },
};

export const CURRENCY_LIST = Object.values(SUPPORTED_CURRENCIES);

export function isValidCurrency(code: string): code is SupportedCurrency {
  return code in SUPPORTED_CURRENCIES;
}

/**
 * Format amount in specified currency using Intl.NumberFormat
 */
export function formatCurrency(
  amount: number,
  currencyCode: SupportedCurrency | string = "USD",
  showSign: boolean = false
): string {
  const code = (isValidCurrency(currencyCode) ? currencyCode : "USD") as SupportedCurrency;
  const config = SUPPORTED_CURRENCIES[code];

  const formatted = new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: config.code,
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals,
  }).format(Math.abs(amount));

  if (showSign) {
    if (amount > 0) return `+${formatted}`;
    if (amount < 0) return `-${formatted}`;
  } else if (amount < 0) {
    return `-${formatted}`;
  }

  return formatted;
}
