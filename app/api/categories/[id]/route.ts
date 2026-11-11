import { NextRequest, NextResponse } from "next/server";
import { requireUser, parseJson, internalError } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
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
    const auth = await requireUser(req);
    if ("response" in auth) return auth.response;
    const { session } = auth;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid category ID" }, { status: 400 });
    }

    const body = await parseJson(req, categorySchema);
    if ("response" in body) return body.response;
    const { name, type, icon, color } = body.data;

    await connectToDatabase();
    const category = await Category.findOne({
      _id: id,
      userId: auth.userObjectId,
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
    await recordAudit({ userId: session.userId, action: "category.update", entityId: id, req });

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
  } catch (error) {
    return internalError("update_category_error", error, "Failed to update category", { route: "/api/categories/[id]" });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requireUser(req);
    if ("response" in auth) return auth.response;
    const { session } = auth;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid category ID" }, { status: 400 });
    }

    await connectToDatabase();
    const category = await Category.findOne({
      _id: id,
      userId: auth.userObjectId,
    });

    if (!category) {
      return NextResponse.json(
        { success: false, error: "Category not found or you do not have permission to delete it" },
        { status: 404 }
      );
    }

    // Check if category is used in user's transactions
    const transactionCount = await Transaction.countDocuments({
      userId: auth.userObjectId,
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
      userId: auth.userObjectId,
      categoryId: category._id,
    });

    await Category.deleteOne({ _id: category._id });
    await recordAudit({
      userId: session.userId,
      action: "category.delete",
      entityId: id,
      metadata: { name: category.name },
      req,
    });

    return NextResponse.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    return internalError("delete_category_error", error, "Failed to delete category", { route: "/api/categories/[id]" });
  }
}
