import { describe, it, expect } from "vitest";
import { parseTableState, toSearchParams } from "@/features/transactions/useTransactionsUrlState";

describe("transactions URL state", () => {
  it("parses drill-down links from reports", () => {
    const s = parseTableState(
      new URLSearchParams("categoryId=abc&type=expense&startDate=2026-10-01&endDate=2026-10-31")
    );
    expect(s.filters).toEqual({
      categoryId: "abc",
      type: "expense",
      startDate: "2026-10-01",
      endDate: "2026-10-31",
    });
    expect(s).toMatchObject({ sortBy: "date", sortOrder: "desc", page: 1, limit: 25 });
  });

  it("rejects unknown sort fields and page sizes", () => {
    const s = parseTableState(new URLSearchParams("sortBy=__proto__&limit=100000&page=-4"));
    expect(s).toMatchObject({ sortBy: "date", limit: 25, page: 1 });
  });

  it("round-trips and omits defaults", () => {
    const params = toSearchParams({
      filters: { search: "rent", minAmount: "100" },
      sortBy: "amount",
      sortOrder: "asc",
      page: 3,
      limit: 50,
    });
    expect(params.toString()).toBe("search=rent&minAmount=100&sortBy=amount&sortOrder=asc&page=3&limit=50");
    expect(toSearchParams(parseTableState(params)).toString()).toBe(params.toString());
    expect(
      toSearchParams({ filters: {}, sortBy: "date", sortOrder: "desc", page: 1, limit: 25 }).toString()
    ).toBe("");
  });
});
