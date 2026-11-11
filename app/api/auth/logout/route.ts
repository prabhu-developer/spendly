import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, getCurrentUser } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await getCurrentUser(req).catch(() => null);
  const response = NextResponse.json({
    success: true,
    message: "Logged out successfully",
  });
  clearSessionCookie(response);
  if (session?.userId) {
    await recordAudit({ userId: session.userId, action: "auth.logout", req });
  }
  return response;
}
