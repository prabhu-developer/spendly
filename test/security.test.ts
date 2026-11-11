import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/auth/origin";

/* ---------------- same-origin (CSRF) matrix ---------------- */

function req(method: string, headers: Record<string, string>, url = "https://app.spendly.test/api/x") {
  return { method, url, headers: new Headers({ host: "app.spendly.test", ...headers }) };
}

describe("isSameOriginRequest", () => {
  const cases: [string, ReturnType<typeof req>, boolean][] = [
    ["GET is always allowed", req("GET", { origin: "https://evil.test" }), true],
    ["HEAD is always allowed", req("HEAD", {}), true],
    ["OPTIONS is always allowed", req("OPTIONS", { origin: "https://evil.test" }), true],
    ["POST same origin", req("POST", { origin: "https://app.spendly.test" }), true],
    ["POST cross origin", req("POST", { origin: "https://evil.test" }), false],
    ["POST lookalike subdomain", req("POST", { origin: "https://app.spendly.test.evil.test" }), false],
    ["POST different port", req("POST", { origin: "https://app.spendly.test:8443" }), false],
    ["POST opaque origin 'null'", req("POST", { origin: "null" }), false],
    ["POST malformed origin", req("POST", { origin: "not a url" }), false],
    ["DELETE no origin, sec-fetch-site same-origin", req("DELETE", { "sec-fetch-site": "same-origin" }), true],
    ["PUT no origin, sec-fetch-site none (user-initiated)", req("PUT", { "sec-fetch-site": "none" }), true],
    ["POST no origin, sec-fetch-site cross-site", req("POST", { "sec-fetch-site": "cross-site" }), false],
    ["POST no origin, sec-fetch-site same-site (sibling subdomain)", req("POST", { "sec-fetch-site": "same-site" }), false],
    ["POST no origin, same-origin referer", req("POST", { referer: "https://app.spendly.test/dashboard" }), true],
    ["POST no origin, cross-origin referer", req("POST", { referer: "https://evil.test/page" }), false],
    ["POST with no origin metadata at all", req("POST", {}), false],
    ["POST via x-forwarded-host", req("POST", { origin: "https://public.spendly.app", "x-forwarded-host": "public.spendly.app" }), true],
  ];

  it.each(cases)("%s", (_name, input, expected) => {
    expect(isSameOriginRequest(input)).toBe(expected);
  });

  it("trusts configured app origins (NEXT_PUBLIC_APP_URL)", () => {
    const input = { ...req("POST", { origin: "https://spendly.example" }), allowedOrigins: ["https://spendly.example/"] };
    expect(isSameOriginRequest(input)).toBe(true);
    expect(isSameOriginRequest({ ...input, allowedOrigins: [undefined] })).toBe(false);
  });
});

/* ---------------- shared rate limiter fallback ---------------- */

const findOneAndUpdate = vi.fn();
const deleteMany = vi.fn();
const connect = vi.fn();

vi.mock("@/models/RateLimit", () => ({
  RateLimit: {
    findOneAndUpdate: (...args: unknown[]) => findOneAndUpdate(...args),
    deleteMany: (...args: unknown[]) => deleteMany(...args),
  },
}));
vi.mock("@/lib/db/mongodb", () => ({ connectToDatabase: () => connect() }));

describe("shared rate limiter", () => {
  beforeEach(() => {
    findOneAndUpdate.mockReset();
    deleteMany.mockReset();
    connect.mockReset().mockResolvedValue(undefined);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("evaluates the fixed window", async () => {
    const { evaluateWindow } = await import("@/lib/auth/rateLimiter");
    const opts = { limit: 3, windowMs: 60_000 };
    expect(evaluateWindow(3, 0, opts, 10_000)).toEqual({ allowed: true, remaining: 0, resetInSeconds: 50 });
    expect(evaluateWindow(4, 0, opts, 59_999).allowed).toBe(false);
    expect(evaluateWindow(4, 0, opts, 59_999).resetInSeconds).toBe(1);
  });

  it("uses the shared counter from MongoDB", async () => {
    const { checkRateLimitShared } = await import("@/lib/auth/rateLimiter");
    findOneAndUpdate.mockResolvedValue({ count: 6 });
    const result = await checkRateLimitShared("t:shared", { limit: 5, windowMs: 60_000 });
    expect(result.allowed).toBe(false);
    const [filter, update, options] = findOneAndUpdate.mock.calls[0];
    expect(filter.key).toMatch(/^t:shared:\d+$/);
    expect(update.$inc).toEqual({ count: 1 });
    expect(options).toMatchObject({ upsert: true, new: true });
  });

  it("retries once on a duplicate-key upsert race", async () => {
    const { checkRateLimitShared } = await import("@/lib/auth/rateLimiter");
    findOneAndUpdate
      .mockRejectedValueOnce(Object.assign(new Error("dup"), { code: 11000 }))
      .mockResolvedValueOnce({ count: 2 });
    const result = await checkRateLimitShared("t:race", { limit: 5, windowMs: 60_000 });
    expect(result).toMatchObject({ allowed: true, remaining: 3 });
    expect(findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it("falls back to the in-memory limiter when the store is down (and still limits)", async () => {
    const { checkRateLimitShared } = await import("@/lib/auth/rateLimiter");
    connect.mockRejectedValue(new Error("ECONNREFUSED"));
    const opts = { limit: 2, windowMs: 60_000 };
    expect((await checkRateLimitShared("t:down", opts)).allowed).toBe(true);
    expect((await checkRateLimitShared("t:down", opts)).allowed).toBe(true);
    expect((await checkRateLimitShared("t:down", opts)).allowed).toBe(false);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("enforceWriteRateLimit returns a 429 with Retry-After when exceeded", async () => {
    const { enforceWriteRateLimit } = await import("@/lib/auth/rateLimiter");
    findOneAndUpdate.mockResolvedValue({ count: 121 });
    const response = await enforceWriteRateLimit("user1");
    expect(response?.status).toBe(429);
    expect(Number(response?.headers.get("Retry-After"))).toBeGreaterThan(0);

    findOneAndUpdate.mockResolvedValue({ count: 1 });
    expect(await enforceWriteRateLimit("user1")).toBeNull();
  });
});

/* ---------------- guard JSON parsing ---------------- */

describe("parseJson", () => {
  const schema = z.object({ amount: z.number().positive("Amount must be positive") });
  const jsonRequest = (body: string) =>
    new Request("https://app.spendly.test/api/x", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
    });

  it("returns typed data for valid input", async () => {
    const { parseJson } = await import("@/lib/auth/guard");
    const result = await parseJson(jsonRequest('{"amount":5}'), schema);
    expect(result).toEqual({ data: { amount: 5 } });
  });

  it("returns 400 with the first issue message for invalid input", async () => {
    const { parseJson } = await import("@/lib/auth/guard");
    const result = await parseJson(jsonRequest('{"amount":-1}'), schema);
    expect("response" in result).toBe(true);
    if ("response" in result) {
      expect(result.response.status).toBe(400);
      expect(await result.response.json()).toEqual({ success: false, error: "Amount must be positive" });
    }
  });

  it("returns 400 for malformed JSON instead of throwing (was a 500)", async () => {
    const { parseJson } = await import("@/lib/auth/guard");
    const result = await parseJson(jsonRequest("{not json"), schema);
    expect("response" in result && result.response.status).toBe(400);
  });
});

describe("assertSameOrigin", () => {
  it("returns 403 for cross-origin mutations and null otherwise", async () => {
    const { assertSameOrigin } = await import("@/lib/auth/guard");
    const blocked = assertSameOrigin(
      new Request("https://app.spendly.test/api/x", { method: "POST", headers: { origin: "https://evil.test" } })
    );
    expect(blocked?.status).toBe(403);
    expect(
      assertSameOrigin(
        new Request("https://app.spendly.test/api/x", {
          method: "POST",
          headers: { origin: "https://app.spendly.test" },
        })
      )
    ).toBeNull();
  });
});
