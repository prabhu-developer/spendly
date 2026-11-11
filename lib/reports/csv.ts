/**
 * RFC 4180 CSV builder with spreadsheet formula-injection protection.
 * Cells beginning with = + - @ (or tab / carriage return) are prefixed with a
 * single quote so Excel / Sheets treat them as text rather than formulas.
 * Plain numbers (including negatives like -12.5) are left untouched.
 */
export interface CsvColumn {
  key: string;
  header: string;
}

export interface CsvOptions {
  /** Prepend a UTF-8 BOM so Excel detects UTF-8 (₹, €, non-latin titles). Default true. */
  bom?: boolean;
}

const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
const NUMERIC = /^-?\d+(\.\d+)?$/;

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text: string;
  if (value instanceof Date) text = value.toISOString();
  else if (typeof value === "number") text = Number.isFinite(value) ? String(value) : "";
  else text = String(value);

  if (typeof value !== "number" && FORMULA_TRIGGER.test(text) && !NUMERIC.test(text)) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(
  rows: Record<string, unknown>[],
  columns: CsvColumn[],
  options: CsvOptions = {}
): string {
  const { bom = true } = options;
  const lines = [columns.map((c) => escapeCsvCell(c.header)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsvCell(row[c.key])).join(","));
  }
  return (bom ? "﻿" : "") + lines.join("\r\n") + "\r\n";
}

/** Browser helper: trigger a download of CSV text. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
