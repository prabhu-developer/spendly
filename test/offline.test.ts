import { describe, it, expect } from "vitest";
import { isNetworkError, resolveSyncAction } from "@/lib/offline/syncLogic";

describe("resolveSyncAction", () => {
  it("deletes drafts the server created or already had (idempotent duplicate)", () => {
    expect(resolveSyncAction({ status: 201, body: { success: true } })).toEqual({ kind: "delete" });
    expect(resolveSyncAction({ status: 200, body: { success: true, duplicate: true } })).toEqual({
      kind: "delete",
    });
  });

  it("flags validation failures with the server message and keeps the data", () => {
    expect(resolveSyncAction({ status: 400, body: { error: "Selected category does not exist" } })).toEqual({
      kind: "flag",
      error: "Selected category does not exist",
    });
    const fallback = resolveSyncAction({ status: 422 });
    expect(fallback.kind).toBe("flag");
  });

  it("stops (keeping everything) when signed out", () => {
    expect(resolveSyncAction({ status: 401 })).toEqual({ kind: "stop", reason: "unauthorized" });
    expect(resolveSyncAction({ status: 403 })).toEqual({ kind: "stop", reason: "unauthorized" });
  });

  it("treats rate limits, timeouts and server errors as transient", () => {
    for (const status of [408, 429, 500, 502, 503]) {
      expect(resolveSyncAction({ status })).toEqual({ kind: "stop", reason: "server" });
    }
  });

  it("stops on network failure", () => {
    expect(resolveSyncAction({ networkError: true })).toEqual({ kind: "stop", reason: "network" });
  });
});

describe("isNetworkError", () => {
  it("recognises axios errors without a response", () => {
    expect(isNetworkError({ isAxiosError: true, code: "ERR_NETWORK" })).toBe(true);
  });

  it("ignores axios errors that got a response or were cancelled", () => {
    expect(isNetworkError({ isAxiosError: true, response: { status: 400 } })).toBe(false);
    expect(isNetworkError({ isAxiosError: true, code: "ERR_CANCELED" })).toBe(false);
  });

  it("recognises fetch TypeErrors", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkError(new TypeError("Load failed"))).toBe(true);
    expect(isNetworkError(new TypeError("x is not a function"))).toBe(false);
  });

  it("is false for non-errors", () => {
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError("offline")).toBe(false);
    expect(isNetworkError(new Error("boom"))).toBe(false);
  });
});
