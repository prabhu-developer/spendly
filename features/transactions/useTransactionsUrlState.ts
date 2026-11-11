"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export const FILTER_KEYS = [
  "search",
  "type",
  "categoryId",
  "accountId",
  "startDate",
  "endDate",
  "minAmount",
  "maxAmount",
] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];
export type Filters = Partial<Record<FilterKey, string>>;

export type SortBy = "date" | "amount" | "title";
export const PAGE_SIZES = [25, 50, 100, 200] as const;

export interface TableState {
  filters: Filters;
  sortBy: SortBy;
  sortOrder: "asc" | "desc";
  page: number;
  limit: number;
}

/** Parse table state from the URL — the URL is the single source of truth. */
export function parseTableState(params: URLSearchParams): TableState {
  const filters: Filters = {};
  for (const key of FILTER_KEYS) {
    const v = params.get(key);
    if (v) filters[key] = v;
  }
  const sortBy = (["date", "amount", "title"] as const).find((s) => s === params.get("sortBy")) ?? "date";
  const limitParam = Number(params.get("limit"));
  return {
    filters,
    sortBy,
    sortOrder: params.get("sortOrder") === "asc" ? "asc" : "desc",
    page: Math.max(1, Number(params.get("page")) || 1),
    limit: (PAGE_SIZES as readonly number[]).includes(limitParam) ? limitParam : 25,
  };
}

/** Serialize table state into API/URL query params (defaults omitted for clean URLs). */
export function toSearchParams(state: TableState): URLSearchParams {
  const p = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const v = state.filters[key];
    if (v) p.set(key, v);
  }
  if (state.sortBy !== "date") p.set("sortBy", state.sortBy);
  if (state.sortOrder !== "desc") p.set("sortOrder", state.sortOrder);
  if (state.page > 1) p.set("page", String(state.page));
  if (state.limit !== 25) p.set("limit", String(state.limit));
  return p;
}

export function useTransactionsUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const state = useMemo(() => parseTableState(new URLSearchParams(searchParams.toString())), [searchParams]);

  const update = useCallback(
    (patch: Partial<TableState>, { resetPage = true }: { resetPage?: boolean } = {}) => {
      const next: TableState = {
        ...state,
        ...patch,
        filters: patch.filters ?? state.filters,
        page: patch.page ?? (resetPage ? 1 : state.page),
      };
      const qs = toSearchParams(next).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [state, router, pathname]
  );

  const setFilter = useCallback(
    (key: FilterKey, value: string | undefined) => {
      const filters = { ...state.filters };
      if (value && value !== "all") filters[key] = value;
      else delete filters[key];
      update({ filters });
    },
    [state.filters, update]
  );

  const activeFilterCount = Object.keys(state.filters).length;
  return { state, update, setFilter, activeFilterCount };
}
