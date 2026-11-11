import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import type { z } from "zod";
import { getCurrentUser, clearSessionCookie, type SessionPayload } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/auth/origin";
import { connectToDatabase } from "@/lib/db/mongodb";
import { User } from "@/models/User";
import { logError } from "@/lib/observability/logger";

export interface AuthContext {
  session: SessionPayload;
  userObjectId: mongoose.Types.ObjectId;
}

export type GuardFailure = { response: NextResponse };

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function unauthorizedResponse(clearCookie = false): NextResponse {
  const response = NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (clearCookie) clearSessionCookie(response);
  return response;
}

/**
 * Has this session been revoked by a password change?
 *
 * Tradeoff: the session is a stateless JWT, so revocation needs a DB read.
 * To keep reads (the hot path) cheap we only check on mutating requests and
 * /api/auth/me. A revoked token can therefore still *read* data until it
 * expires (≤7 days) but cannot change anything, and the client is logged out
 * the next time it calls /api/auth/me.
 */
export async function isSessionRevoked(session: SessionPayload): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(session.userId)) return true;
  await connectToDatabase();
  const user = await User.findById(session.userId).select("sessionVersion").lean();
  if (!user) return true;
  return (user.sessionVersion ?? 0) !== (session.sv ?? 0);
}

/**
 * Authenticate a route handler request.
 *   const auth = await requireUser(req);
 *   if ("response" in auth) return auth.response;
 *
 * `checkSessionVersion` defaults to true for POST/PUT/PATCH/DELETE.
 */
export async function requireUser(
  req: NextRequest,
  options: { checkSessionVersion?: boolean } = {}
): Promise<AuthContext | GuardFailure> {
  const session = await getCurrentUser(req);
  if (!session?.userId || !mongoose.Types.ObjectId.isValid(session.userId)) {
    return { response: unauthorizedResponse() };
  }

  const checkVersion = options.checkSessionVersion ?? MUTATING_METHODS.has(req.method.toUpperCase());
  if (checkVersion && (await isSessionRevoked(session))) {
    return { response: unauthorizedResponse(true) };
  }

  return { session, userObjectId: new mongoose.Types.ObjectId(session.userId) };
}

/**
 * Parse and validate a JSON body.
 *   const body = await parseJson(req, schema);
 *   if ("response" in body) return body.response;
 *   body.data // typed z.output<schema>
 */
export async function parseJson<S extends z.ZodType>(
  req: Request,
  schema: S,
  fallbackMessage = "Invalid input"
): Promise<{ data: z.output<S> } | GuardFailure> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      response: NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 }),
    };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      response: NextResponse.json(
        { success: false, error: result.error.issues[0]?.message || fallbackMessage },
        { status: 400 }
      ),
    };
  }
  return { data: result.data };
}

/**
 * CSRF guard for mutating requests. proxy.ts already applies this to every
 * /api request; call it in handlers that may be reached another way.
 * Returns a 403 response, or null when allowed.
 */
export function assertSameOrigin(req: Request): NextResponse | null {
  const ok = isSameOriginRequest({
    method: req.method,
    url: req.url,
    headers: req.headers,
    allowedOrigins: [process.env.NEXT_PUBLIC_APP_URL],
  });
  return ok
    ? null
    : NextResponse.json({ success: false, error: "Cross-origin request blocked" }, { status: 403 });
}

/** Log the real error server-side; return a generic message to the client. */
export function internalError(
  event: string,
  error: unknown,
  clientMessage: string,
  fields: Record<string, unknown> = {}
): NextResponse {
  logError(event, error, fields);
  return NextResponse.json({ success: false, error: clientMessage }, { status: 500 });
}
