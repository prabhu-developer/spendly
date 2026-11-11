import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { User } from "@/models/User";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validations/auth";
import { checkRateLimitShared, resetRateLimitShared, rateLimitResponse } from "@/lib/auth/rateLimiter";
import { parseJson, internalError } from "@/lib/auth/guard";
import { recordAudit, getClientIp } from "@/lib/audit";

const PER_ACCOUNT_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };
// Broader per-IP ceiling to slow credential stuffing across many emails
const PER_IP_LIMIT = { limit: 50, windowMs: 15 * 60 * 1000 };

// Constant-time-ish failure path: compare against a dummy hash when the user doesn't exist
// so response timing doesn't reveal which emails are registered.
const DUMMY_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8.Mxj6eHnkq6fWw1YzXo6cGJ1L8pG2";

function invalidCredentials() {
  return NextResponse.json({ success: false, error: "Invalid email or password" }, { status: 401 });
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req) || "unknown";

    const ipCheck = await checkRateLimitShared(`login-ip:${ip}`, PER_IP_LIMIT);
    if (!ipCheck.allowed) {
      return rateLimitResponse(
        ipCheck,
        `Too many failed login attempts. Please try again in ${ipCheck.resetInSeconds} seconds.`
      );
    }

    const body = await parseJson(req, loginSchema, "Invalid email or password");
    if ("response" in body) return body.response;
    const { email, password } = body.data;

    const accountKey = `login:${ip}:${email}`;
    const rateCheck = await checkRateLimitShared(accountKey, PER_ACCOUNT_LIMIT);
    if (!rateCheck.allowed) {
      return rateLimitResponse(
        rateCheck,
        `Too many failed login attempts. Please try again in ${rateCheck.resetInSeconds} seconds.`
      );
    }

    await connectToDatabase();

    const user = await User.findOne({ email });
    const isMatch = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !isMatch) {
      await recordAudit({
        userId: user ? user._id.toString() : null,
        action: "auth.login_failed",
        metadata: { email, reason: user ? "bad_password" : "unknown_email" },
        req,
      });
      return invalidCredentials();
    }

    await resetRateLimitShared(accountKey);

    const token = await createSessionToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      preferredCurrency: user.preferredCurrency,
      sv: user.sessionVersion ?? 0,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        preferredCurrency: user.preferredCurrency,
      },
    });

    setSessionCookie(response, token);
    await recordAudit({ userId: user._id.toString(), action: "auth.login", req });
    return response;
  } catch (error) {
    return internalError("auth.login_error", error, "Authentication failed. Please try again later.", {
      route: "/api/auth/login",
    });
  }
}
