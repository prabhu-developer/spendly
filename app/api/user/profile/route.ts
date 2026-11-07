import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { User } from "@/models/User";
import { updateProfileSchema } from "@/lib/validations/auth";

export async function PUT(req: NextRequest) {
  try {
    const session = await getCurrentUser(req);
    if (!session || !session.userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validation = updateProfileSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0]?.message || "Invalid data" },
        { status: 400 }
      );
    }

    const { name, preferredCurrency, dateFormat } = validation.data;

    await connectToDatabase();
    const updatedUser = await User.findByIdAndUpdate(
      session.userId,
      { name, preferredCurrency, dateFormat },
      { new: true }
    ).select("-passwordHash");

    if (!updatedUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    // Refresh JWT session cookie with new currency/name
    const token = await createSessionToken({
      userId: updatedUser._id.toString(),
      email: updatedUser.email,
      name: updatedUser.name,
      preferredCurrency: updatedUser.preferredCurrency,
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
    return response;
  } catch (error: any) {
    console.error("Update profile error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
