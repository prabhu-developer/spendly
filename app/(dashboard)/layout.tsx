import React from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Category } from "@/models/Category";
import mongoose from "mongoose";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentUser();

  if (!session || !session.userId) {
    redirect("/login");
  }

  // Fetch categories for the current user to supply quick-add dialog
  let categories: any[] = [];
  try {
    await connectToDatabase();
    const userObjectId = new mongoose.Types.ObjectId(session.userId);
    const cats = await Category.find({
      $or: [{ userId: userObjectId }, { isSystem: true }],
    }).sort({ name: 1 });

    categories = cats.map((c) => ({
      id: c._id.toString(),
      name: c.name,
      type: c.type,
      icon: c.icon,
      color: c.color,
    }));
  } catch (e) {
    console.error("Failed to prefetch categories:", e);
  }

  return (
    <DashboardShell user={session} initialCategories={categories}>
      {children}
    </DashboardShell>
  );
}
