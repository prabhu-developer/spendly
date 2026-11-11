import { z } from "zod";
import { differenceInCalendarDays, endOfMonth, startOfMonth } from "date-fns";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_REPORT_RANGE_DAYS = 366 * 5;

const dateParam = z
  .string()
  .trim()
  .max(40)
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Invalid date")
  .optional();

export const reportRangeQuerySchema = z.object({
  startDate: dateParam,
  endDate: dateParam,
});

/** Parse a date param. Date-only strings are interpreted in server local time (start/end of day). */
function parseDate(value: string, endOfDay: boolean): Date {
  if (DATE_ONLY.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d);
  }
  return new Date(value);
}

export type ReportRange =
  | { ok: true; start: Date; end: Date; prevStart: Date; prevEnd: Date }
  | { ok: false; error: string };

/**
 * Validate and resolve the report range (defaults to the current month) plus the
 * equal-length previous period used for comparisons.
 */
export function resolveReportRange(searchParams: URLSearchParams, now = new Date()): ReportRange {
  const parsed = reportRangeQuerySchema.safeParse({
    startDate: searchParams.get("startDate") ?? undefined,
    endDate: searchParams.get("endDate") ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: "Invalid report date range" };

  const start = parsed.data.startDate ? parseDate(parsed.data.startDate, false) : startOfMonth(now);
  const end = parsed.data.endDate ? parseDate(parsed.data.endDate, true) : endOfMonth(now);
  if (start > end) return { ok: false, error: "Start date must be before end date" };
  if (differenceInCalendarDays(end, start) > MAX_REPORT_RANGE_DAYS) {
    return { ok: false, error: "Report range cannot exceed 5 years" };
  }

  const duration = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - duration);
  return { ok: true, start, end, prevStart, prevEnd };
}

/** IANA timezone used for month bucketing in Mongo — matches date-fns `format` on the server. */
export function serverTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
