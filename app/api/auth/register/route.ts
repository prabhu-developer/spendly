import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { User } from "@/models/User";
import { Category } from "@/models/Category";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { registerSchema } from "@/lib/validations/auth";
import { checkRateLimitShared, rateLimitResponse } from "@/lib/auth/rateLimiter";
import { parseJson, internalError } from "@/lib/auth/guard";
import { recordAudit, getClientIp } from "@/lib/audit";
import { DEFAULT_CATEGORIES } from "@/constants/defaultCategories";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req) || "unknown";
    const rateCheck = await checkRateLimitShared(`register:${ip}`, {
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });
    if (!rateCheck.allowed) {
      return rateLimitResponse(
        rateCheck,
        `Too many registration attempts. Please try again in ${rateCheck.resetInSeconds} seconds.`
      );
    }

    const body = await parseJson(req, registerSchema, "Invalid input data");
    if ("response" in body) return body.response;
    const { name, email, password, preferredCurrency } = body.data;

    await connectToDatabase();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "An account with this email address already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const newUser = await User.create({
      name,
      email,
      passwordHash,
      preferredCurrency,
    });

    // Seed default categories for this newly registered user
    const userCategories = DEFAULT_CATEGORIES.map((cat) => ({
      userId: newUser._id,
      name: cat.name,
      type: cat.type,
      icon: cat.icon,
      color: cat.color,
      isSystem: false,
    }));
    await Category.insertMany(userCategories);

    // Create session token and set HTTP-only cookie
    const token = await createSessionToken({
      userId: newUser._id.toString(),
      email: newUser.email,
      name: newUser.name,
      preferredCurrency: newUser.preferredCurrency,
      sv: newUser.sessionVersion ?? 0,
    });

    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: newUser._id.toString(),
          name: newUser.name,
          email: newUser.email,
          preferredCurrency: newUser.preferredCurrency,
        },
      },
      { status: 201 }
    );

    setSessionCookie(response, token);
    await recordAudit({ userId: newUser._id.toString(), action: "auth.register", req });
    return response;
  } catch (error) {
    // Concurrent registration with the same email hits the unique index
    if ((error as { code?: number })?.code === 11000) {
      return NextResponse.json(
        { success: false, error: "An account with this email address already exists" },
        { status: 409 }
      );
    }
    return internalError("auth.register_error", error, "Failed to register account", {
      route: "/api/auth/register",
    });
  }
}
