import React from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Category } from "@/models/Category";
import { QueryProvider } from "@/components/providers/QueryProvider";
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

  await connectToDatabase();
  const userObjectId = new mongoose.Types.ObjectId(session.userId);
  const cats = await Category.find({
    $or: [{ userId: userObjectId }, { isSystem: true }],
  })
    .select("name type icon color")
    .sort({ name: 1 })
    .lean();

  const categories = cats.map((category) => ({
    id: category._id.toString(),
    name: category.name,
    type: category.type,
    icon: category.icon,
    color: category.color,
  }));

  return (
    <QueryProvider initialCategories={categories} initialUser={session}>
      <DashboardShell user={session}>
        {children}
      </DashboardShell>
    </QueryProvider>
  );
}
