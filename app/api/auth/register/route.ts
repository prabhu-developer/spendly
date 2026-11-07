import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { User } from "@/models/User";
import { Category } from "@/models/Category";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { registerSchema } from "@/lib/validations/auth";
import { checkRateLimit } from "@/lib/auth/rateLimiter";
import { DEFAULT_CATEGORIES } from "@/constants/defaultCategories";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "client";
    const rateCheck = checkRateLimit(`register:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many registration attempts. Please try again in ${rateCheck.resetInSeconds} seconds.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const validation = registerSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.issues[0]?.message || "Invalid input data",
        },
        { status: 400 }
      );
    }

    const { name, email, password, preferredCurrency } = validation.data;

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
    return response;
  } catch (error: any) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to register account" },
      { status: 500 }
    );
  }
}
