import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SupportedCurrency } from "@/lib/currency/currencies";

export const AUTH_COOKIE_NAME = "spendly_session";
const DEFAULT_SESSION_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  preferredCurrency: SupportedCurrency;
  [key: string]: unknown;
}

function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET || "spendly-super-secure-production-jwt-key-2026-min-32-chars";
  return new TextEncoder().encode(secret);
}

/**
 * Sign JWT session token
 */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DEFAULT_SESSION_DURATION}s`)
    .sign(getAuthSecret());
}

/**
 * Verify JWT session token
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Set HTTP-only session cookie on a NextResponse
 */
export function setSessionCookie(response: NextResponse, token: string): void {
  const isProduction = process.env.NODE_ENV === "production";
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: DEFAULT_SESSION_DURATION,
  });
}

/**
 * Clear session cookie on a NextResponse
 */
export function clearSessionCookie(response: NextResponse): void {
  const isProduction = process.env.NODE_ENV === "production";
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Server-side session verification helper for Server Components and Route Handlers
 */
export async function getCurrentUser(req?: NextRequest): Promise<SessionPayload | null> {
  let token: string | undefined;

  if (req) {
    token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  } else {
    try {
      const cookieStore = cookies();
      token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    } catch {
      return null;
    }
  }

  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Helper to require authenticated session in API routes.
 * Throws or returns 401 response if not authenticated.
 */
export async function requireAuth(req: NextRequest): Promise<{ user: SessionPayload } | { errorResponse: NextResponse }> {
  const user = await getCurrentUser(req);
  if (!user || !user.userId) {
    return {
      errorResponse: NextResponse.json(
        { success: false, error: "Unauthorized. Please log in to continue." },
        { status: 401 }
      ),
    };
  }
  return { user };
}
