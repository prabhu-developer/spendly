import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { User } from "@/models/User";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { changePasswordSchema } from "@/lib/validations/auth";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { requireUser, parseJson, internalError } from "@/lib/auth/guard";
import { checkRateLimitShared, rateLimitResponse } from "@/lib/auth/rateLimiter";
import { recordAudit } from "@/lib/audit";

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if ("response" in auth) return auth.response;
    const { session } = auth;

    // Limits brute-forcing the current password from a hijacked session
    const rateCheck = await checkRateLimitShared(`password:${session.userId}`, {
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!rateCheck.allowed) {
      return rateLimitResponse(
        rateCheck,
        `Too many password change attempts. Please try again in ${rateCheck.resetInSeconds} seconds.`
      );
    }

    const body = await parseJson(req, changePasswordSchema, "Invalid data");
    if ("response" in body) return body.response;
    const { currentPassword, newPassword } = body.data;

    await connectToDatabase();
    const user = await User.findById(auth.userObjectId);
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const isMatch = await verifyPassword(currentPassword, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { success: false, error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    user.passwordHash = await hashPassword(newPassword);
    // Revoke every other session; this request gets a fresh token below
    user.sessionVersion = (user.sessionVersion ?? 0) + 1;
    await user.save();

    const token = await createSessionToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      preferredCurrency: user.preferredCurrency,
      sv: user.sessionVersion,
    });

    const response = NextResponse.json({
      success: true,
      message: "Password changed successfully",
    });
    setSessionCookie(response, token);
    await recordAudit({ userId: session.userId, action: "user.password_change", req });
    return response;
  } catch (error) {
    return internalError("user.password_error", error, "Failed to change password", {
      route: "/api/user/password",
    });
  }
}
