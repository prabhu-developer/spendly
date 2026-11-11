import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { RateLimit } from "@/models/RateLimit";
import { logWarn } from "@/lib/observability/logger";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

/* ------------------------------------------------------------------ */
/* In-memory limiter (per instance). Used directly in tests and as the  */
/* fallback when the shared store is unavailable.                       */
/* ------------------------------------------------------------------ */

const rateLimitMap = new Map<string, RateLimitRecord>();

// Clean up expired entries periodically (unref so it never keeps a process alive)
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  rateLimitMap.forEach((record, key) => {
    if (now > record.resetAt) rateLimitMap.delete(key);
  });
}, 60 * 1000);
(cleanupTimer as { unref?: () => void }).unref?.();

export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = { limit: 5, windowMs: 15 * 60 * 1000 }
): RateLimitResult {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + options.windowMs });
    return {
      allowed: true,
      remaining: options.limit - 1,
      resetInSeconds: Math.ceil(options.windowMs / 1000),
    };
  }

  if (record.count >= options.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds: Math.ceil((record.resetAt - now) / 1000),
    };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: options.limit - record.count,
    resetInSeconds: Math.ceil((record.resetAt - now) / 1000),
  };
}

export function resetRateLimit(identifier: string): void {
  rateLimitMap.delete(identifier);
}

/* ------------------------------------------------------------------ */
/* Shared limiter (MongoDB). Correct across serverless instances.       */
/* ------------------------------------------------------------------ */

/** Pure: evaluate a fixed-window counter value. Exported for tests. */
export function evaluateWindow(
  count: number,
  windowStart: number,
  options: RateLimitOptions,
  now: number
): RateLimitResult {
  const resetInSeconds = Math.max(1, Math.ceil((windowStart + options.windowMs - now) / 1000));
  return {
    allowed: count <= options.limit,
    remaining: Math.max(0, options.limit - count),
    resetInSeconds,
  };
}

async function incrementWindow(key: string, identifier: string, expiresAt: Date): Promise<number> {
  const update = { $inc: { count: 1 }, $setOnInsert: { identifier, expiresAt } };
  try {
    const doc = await RateLimit.findOneAndUpdate({ key }, update, {
      upsert: true,
      new: true,
      lean: true,
    });
    return doc?.count ?? 1;
  } catch (error) {
    // Two concurrent upserts can race on the unique key; the retry hits the existing doc.
    if ((error as { code?: number })?.code === 11000) {
      const doc = await RateLimit.findOneAndUpdate({ key }, update, { new: true, lean: true });
      return doc?.count ?? 1;
    }
    throw error;
  }
}

/**
 * Fixed-window rate limit shared across all instances via MongoDB.
 * Fails OPEN to the in-memory limiter if the database is unreachable,
 * so an outage of the limiter store never locks every user out (logged).
 */
export async function checkRateLimitShared(
  identifier: string,
  options: RateLimitOptions = { limit: 5, windowMs: 15 * 60 * 1000 }
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = Math.floor(now / options.windowMs) * options.windowMs;
  try {
    await connectToDatabase();
    const count = await incrementWindow(
      `${identifier}:${windowStart}`,
      identifier,
      new Date(windowStart + options.windowMs)
    );
    return evaluateWindow(count, windowStart, options, now);
  } catch (error) {
    logWarn("rate_limit.shared_store_unavailable", {
      identifier: identifier.split(":")[0],
      error: error instanceof Error ? error.message : String(error),
    });
    return checkRateLimit(identifier, options);
  }
}

/** Clear a shared counter (e.g. after a successful login). Never throws. */
export async function resetRateLimitShared(identifier: string): Promise<void> {
  resetRateLimit(identifier);
  try {
    await connectToDatabase();
    await RateLimit.deleteMany({ identifier });
  } catch (error) {
    logWarn("rate_limit.reset_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Standard 429 response with Retry-After. */
export function rateLimitResponse(
  result: RateLimitResult,
  message = `Too many requests. Please try again in ${result.resetInSeconds} seconds.`
): NextResponse {
  return NextResponse.json(
    { success: false, error: message },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.resetInSeconds),
        "X-RateLimit-Remaining": String(result.remaining),
      },
    }
  );
}

export const WRITE_RATE_LIMIT: RateLimitOptions = { limit: 120, windowMs: 60 * 1000 };

/**
 * Per-user mutation limiter for write endpoints (transactions, accounts, …).
 * Returns a 429 response to send, or null when the request may proceed.
 */
export async function enforceWriteRateLimit(
  userId: string,
  options: RateLimitOptions = WRITE_RATE_LIMIT
): Promise<NextResponse | null> {
  const result = await checkRateLimitShared(`write:${userId}`, options);
  return result.allowed ? null : rateLimitResponse(result);
}
