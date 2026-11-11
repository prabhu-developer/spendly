import { NextRequest, NextResponse } from "next/server";
import { Category } from "@/models/Category";
import { requireUser, parseJson, internalError } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Budget } from "@/models/Budget";
import { budgetSchema } from "@/lib/validations/budget";
import mongoose from "mongoose";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requireUser(req);
    if ("response" in auth) return auth.response;
    const { session, userObjectId } = auth;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid budget ID" }, { status: 400 });
    }

    const body = await parseJson(req, budgetSchema);
    if ("response" in body) return body.response;

    const { amount, currency, month, year, categoryId } = body.data;

    await connectToDatabase();

    const budget = await Budget.findOne({
      _id: id,
      userId: userObjectId,
    });

    if (!budget) {
      return NextResponse.json(
        { success: false, error: "Budget not found or unauthorized" },
        { status: 404 }
      );
    }

    // Authorization: the target category must be the user's own (or a system category)
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return NextResponse.json({ success: false, error: "Invalid category ID" }, { status: 400 });
    }
    const category = await Category.findOne({
      _id: categoryId,
      $or: [{ userId: userObjectId }, { isSystem: true }],
    })
      .select("_id")
      .lean();
    if (!category) {
      return NextResponse.json(
        { success: false, error: "Selected category does not exist" },
        { status: 400 }
      );
    }

    budget.amount = amount;
    budget.currency = currency;
    budget.month = month;
    budget.year = year;
    budget.categoryId = new mongoose.Types.ObjectId(categoryId);
    try {
      await budget.save();
    } catch (error) {
      if ((error as { code?: number })?.code === 11000) {
        return NextResponse.json(
          { success: false, error: "A budget for this category and month already exists" },
          { status: 409 }
        );
      }
      throw error;
    }
    await recordAudit({ userId: session.userId, action: "budget.save", entityId: id, req });

    return NextResponse.json({
      success: true,
      budget: {
        id: budget._id.toString(),
        amount: budget.amount,
        currency: budget.currency,
        month: budget.month,
        year: budget.year,
      },
    });
  } catch (error) {
    return internalError("update_budget_error", error, "Failed to update budget", { route: "/api/budgets/[id]" });
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
    const { session, userObjectId } = auth;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid budget ID" }, { status: 400 });
    }

    await connectToDatabase();

    const deleted = await Budget.findOneAndDelete({
      _id: id,
      userId: userObjectId,
    });

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Budget not found or unauthorized" },
        { status: 404 }
      );
    }

    await recordAudit({ userId: session.userId, action: "budget.delete", entityId: id, req });

    return NextResponse.json({
      success: true,
      message: "Budget deleted successfully",
    });
  } catch (error) {
    return internalError("delete_budget_error", error, "Failed to delete budget", { route: "/api/budgets/[id]" });
  }
}
