import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format numbers avoiding floating point issues.
 * Storing / computing using fixed 2 decimal places precision.
 */
export function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Escape user input for safe literal use inside a RegExp / MongoDB $regex.
 * Prevents regex injection (ReDoS, or 500s on input such as "(").
 */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Percentage change from previous to current, rounded to 2 decimals.
 * Returns 0 when there is no previous baseline.
 */
export function percentChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return roundToTwoDecimals(((current - previous) / Math.abs(previous)) * 100);
}
