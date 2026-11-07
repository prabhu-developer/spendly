import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Category } from "@/models/Category";
import { Transaction } from "@/models/Transaction";
import { Budget } from "@/models/Budget";
import { categorySchema } from "@/lib/validations/category";
import mongoose from "mongoose";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getCurrentUser(req);
    if (!session || !session.userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid category ID" }, { status: 400 });
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
    const category = await Category.findOne({
      _id: id,
      userId: new mongoose.Types.ObjectId(session.userId),
    });

    if (!category) {
      return NextResponse.json(
        { success: false, error: "Category not found or you do not have permission to edit it" },
        { status: 404 }
      );
    }

    category.name = name;
    category.type = type;
    category.icon = icon;
    category.color = color;
    await category.save();

    return NextResponse.json({
      success: true,
      category: {
        id: category._id.toString(),
        name: category.name,
        type: category.type,
        icon: category.icon,
        color: category.color,
      },
    });
  } catch (error: any) {
    console.error("Update category error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update category" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getCurrentUser(req);
    if (!session || !session.userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid category ID" }, { status: 400 });
    }

    await connectToDatabase();
    const category = await Category.findOne({
      _id: id,
      userId: new mongoose.Types.ObjectId(session.userId),
    });

    if (!category) {
      return NextResponse.json(
        { success: false, error: "Category not found or you do not have permission to delete it" },
        { status: 404 }
      );
    }

    // Check if category is used in user's transactions
    const transactionCount = await Transaction.countDocuments({
      userId: new mongoose.Types.ObjectId(session.userId),
      categoryId: category._id,
    });

    if (transactionCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete category "${category.name}" because it is linked to ${transactionCount} transaction(s). Please reassign or delete those transactions first.`,
        },
        { status: 400 }
      );
    }

    // Delete associated budgets for this category if any
    await Budget.deleteMany({
      userId: new mongoose.Types.ObjectId(session.userId),
      categoryId: category._id,
    });

    await Category.deleteOne({ _id: category._id });

    return NextResponse.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete category error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete category" },
      { status: 500 }
    );
  }
}
