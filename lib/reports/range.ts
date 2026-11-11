import { z } from "zod";
import {
  addDays,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  endOfDay,
  endOfMonth,
  isSameDay,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns";

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

  const { prevStart, prevEnd } = previousPeriod(start, end);
  return { ok: true, start, end, prevStart, prevEnd };
}

/**
 * The comparison period immediately before [start, end].
 * - Whole calendar months (e.g. Nov 1–30, or Sep 1–Nov 30) → the same number of
 *   preceding calendar months (Oct 1–31 / Jun 1–Aug 31). A fixed-duration shift
 *   would drop Oct 1 when comparing November with a 31-day October.
 * - Any other range → the same number of calendar days immediately before
 *   (day boundaries, so DST changes can't shift it by an hour).
 */
export function previousPeriod(start: Date, end: Date): { prevStart: Date; prevEnd: Date } {
  const isMonthAligned =
    isSameDay(start, startOfMonth(start)) &&
    start.getTime() === startOfDay(start).getTime() &&
    isSameDay(end, endOfMonth(end));
  if (isMonthAligned) {
    const months = differenceInCalendarMonths(end, start) + 1;
    return {
      prevStart: startOfMonth(subMonths(start, months)),
      prevEnd: endOfMonth(subMonths(start, 1)),
    };
  }
  const days = differenceInCalendarDays(end, start) + 1;
  const prevEnd = endOfDay(addDays(startOfDay(start), -1));
  return { prevStart: startOfDay(addDays(startOfDay(start), -days)), prevEnd };
}

/** IANA timezone used for month bucketing in Mongo — matches date-fns `format` on the server. */
export function serverTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
