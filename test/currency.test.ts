import { describe, it, expect } from "vitest";
import { formatCurrency, isValidCurrency, SUPPORTED_CURRENCIES } from "@/lib/currency/currencies";
import { ExchangeRateService } from "@/lib/currency/exchangeRateService";

describe("Currency Management", () => {
  it("supports all 10 mandated currencies", () => {
    const requiredCurrencies = [
      "INR", "USD", "EUR", "GBP", "AED", "SGD", "CAD", "AUD", "JPY", "SAR"
    ];

    for (const code of requiredCurrencies) {
      expect(isValidCurrency(code)).toBe(true);
      expect(SUPPORTED_CURRENCIES[code as keyof typeof SUPPORTED_CURRENCIES]).toBeDefined();
    }
  });

  it("rejects missing and unsupported currency preferences", () => {
    expect(isValidCurrency(undefined)).toBe(false);
    expect(isValidCurrency(null)).toBe(false);
    expect(isValidCurrency("XYZ")).toBe(false);
  });

  it("properly formats currencies with appropriate symbols and decimals", () => {
    const usd = formatCurrency(1250.5, "USD");
    expect(usd).toContain("$");
    expect(usd).toContain("1,250.50");

    const inr = formatCurrency(50000, "INR");
    expect(inr).toContain("₹");

    const jpy = formatCurrency(1500, "JPY");
    expect(jpy.includes("¥") || jpy.includes("￥")).toBe(true);
    // JPY has 0 decimals
    expect(jpy).not.toContain(".00");
  });

  it("formats positive and negative amounts with proper signs", () => {
    const pos = formatCurrency(100, "USD", true);
    expect(pos).toContain("+");

    const neg = formatCurrency(-50, "USD");
    expect(neg).toContain("-");
  });

  it("accurately converts amounts using exchange rate snapshots", () => {
    const snapshot = {
      USD: 1,
      INR: 84,
      EUR: 0.9,
    };

    // 100 USD to INR
    const convertedINR = ExchangeRateService.convertWithSnapshot(100, "USD", "INR", snapshot);
    expect(convertedINR).toBe(8400);

    // 8400 INR to USD
    const convertedUSD = ExchangeRateService.convertWithSnapshot(8400, "INR", "USD", snapshot);
    expect(convertedUSD).toBe(100);

    // Identity conversion
    expect(ExchangeRateService.convertWithSnapshot(50, "USD", "USD", snapshot)).toBe(50);
  });
});
