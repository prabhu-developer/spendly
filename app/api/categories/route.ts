import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Category } from "@/models/Category";
import { categorySchema } from "@/lib/validations/category";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUser(req);
    if (!session || !session.userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const userObjectId = new mongoose.Types.ObjectId(session.userId);

    // Retrieve user categories OR system categories
    const categories = await Category.find({
      $or: [{ userId: userObjectId }, { isSystem: true }],
    }).sort({ name: 1 });

    return NextResponse.json({
      success: true,
      categories: categories.map((cat) => ({
        id: cat._id.toString(),
        name: cat.name,
        type: cat.type,
        icon: cat.icon,
        color: cat.color,
        isSystem: Boolean(cat.isSystem),
        isOwner: cat.userId?.toString() === session.userId,
      })),
    });
  } catch (error: any) {
    console.error("Get categories error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser(req);
    if (!session || !session.userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validation = categorySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { name, type, icon, color } = validation.data;

    await connectToDatabase();
    const userObjectId = new mongoose.Types.ObjectId(session.userId);

    // Check if category name already exists for this user and type
    const existing = await Category.findOne({
      userId: userObjectId,
      type,
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `A ${type} category named "${name}" already exists` },
        { status: 409 }
      );
    }

    const newCategory = await Category.create({
      userId: userObjectId,
      name,
      type,
      icon,
      color,
      isSystem: false,
    });

    return NextResponse.json(
      {
        success: true,
        category: {
          id: newCategory._id.toString(),
          name: newCategory.name,
          type: newCategory.type,
          icon: newCategory.icon,
          color: newCategory.color,
          isSystem: false,
          isOwner: true,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Create category error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create category" },
      { status: 500 }
    );
  }
}
