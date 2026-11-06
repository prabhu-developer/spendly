import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Budget } from "@/models/Budget";
import { budgetSchema } from "@/lib/validations/budget";
import mongoose from "mongoose";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getCurrentUser(req);
    if (!session || !session.userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ success: false, error: "Invalid budget ID" }, { status: 400 });
    }

    const body = await req.json();
    const validation = budgetSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { amount, currency, month, year, categoryId } = validation.data;

    await connectToDatabase();
    const userObjectId = new mongoose.Types.ObjectId(session.userId);

    const budget = await Budget.findOne({
      _id: params.id,
      userId: userObjectId,
    });

    if (!budget) {
      return NextResponse.json(
        { success: false, error: "Budget not found or unauthorized" },
        { status: 404 }
      );
    }

    budget.amount = amount;
    budget.currency = currency;
    budget.month = month;
    budget.year = year;
    budget.categoryId = new mongoose.Types.ObjectId(categoryId);
    await budget.save();

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
  } catch (error: any) {
    console.error("Update budget error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update budget" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getCurrentUser(req);
    if (!session || !session.userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ success: false, error: "Invalid budget ID" }, { status: 400 });
    }

    await connectToDatabase();
    const userObjectId = new mongoose.Types.ObjectId(session.userId);

    const deleted = await Budget.findOneAndDelete({
      _id: params.id,
      userId: userObjectId,
    });

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Budget not found or unauthorized" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Budget deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete budget error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete budget" },
      { status: 500 }
    );
  }
}
