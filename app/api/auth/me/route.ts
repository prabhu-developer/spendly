import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { User } from "@/models/User";
import { requireUser, unauthorizedResponse, internalError } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req, { checkSessionVersion: false });
    if ("response" in auth) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    await connectToDatabase();
    const user = await User.findById(auth.userObjectId).select("-passwordHash").lean();
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    // Revoked by a password change elsewhere → end this session (see guard.ts tradeoff note)
    if ((user.sessionVersion ?? 0) !== (auth.session.sv ?? 0)) {
      return unauthorizedResponse(true);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        preferredCurrency: user.preferredCurrency,
        dateFormat: user.dateFormat || "MM/dd/yyyy",
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    return internalError("auth.me_error", error, "Failed to retrieve user data", { route: "/api/auth/me" });
  }
}
