import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { User } from "@/models/User";
import { updateProfileSchema } from "@/lib/validations/auth";
import { requireUser, parseJson, internalError } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if ("response" in auth) return auth.response;

    const body = await parseJson(req, updateProfileSchema, "Invalid data");
    if ("response" in body) return body.response;
    const { name, preferredCurrency, dateFormat } = body.data;

    await connectToDatabase();
    const updatedUser = await User.findByIdAndUpdate(
      auth.userObjectId,
      { name, preferredCurrency, dateFormat },
      { new: true, runValidators: true }
    ).select("-passwordHash");

    if (!updatedUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    // Refresh JWT session cookie with new currency/name (keep the session version)
    const token = await createSessionToken({
      userId: updatedUser._id.toString(),
      email: updatedUser.email,
      name: updatedUser.name,
      preferredCurrency: updatedUser.preferredCurrency,
      sv: updatedUser.sessionVersion ?? 0,
    });

    const response = NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: updatedUser._id.toString(),
        name: updatedUser.name,
        email: updatedUser.email,
        preferredCurrency: updatedUser.preferredCurrency,
        dateFormat: updatedUser.dateFormat,
      },
    });

    setSessionCookie(response, token);
    await recordAudit({
      userId: auth.session.userId,
      action: "user.profile_update",
      metadata: {
        currencyChanged: auth.session.preferredCurrency !== updatedUser.preferredCurrency,
      },
      req,
    });
    return response;
  } catch (error) {
    return internalError("user.profile_error", error, "Failed to update profile", {
      route: "/api/user/profile",
    });
  }
}
