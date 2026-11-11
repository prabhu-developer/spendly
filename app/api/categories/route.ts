import { NextRequest, NextResponse } from "next/server";
import { requireUser, parseJson, internalError } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";
import { escapeRegex } from "@/lib/utils";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Category } from "@/models/Category";
import { categorySchema } from "@/lib/validations/category";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if ("response" in auth) return auth.response;
    const { session } = auth;

    await connectToDatabase();
    const { userObjectId } = auth;

    // Retrieve user categories OR system categories
    const categories = await Category.find({
      $or: [{ userId: userObjectId }, { isSystem: true }],
    })
      .select("name type icon color isSystem userId")
      .sort({ name: 1 })
      .lean();

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
  } catch (error) {
    return internalError("get_categories_error", error, "Failed to fetch categories", { route: "/api/categories" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if ("response" in auth) return auth.response;
    const { session } = auth;

    const body = await parseJson(req, categorySchema);
    if ("response" in body) return body.response;
    const { name, type, icon, color } = body.data;

    await connectToDatabase();
    const { userObjectId } = auth;

    // Check if category name already exists for this user and type
    const existing = await Category.findOne({
      userId: userObjectId,
      type,
      // Escaped: category names are user input
      name: { $regex: new RegExp(`^${escapeRegex(name)}$`, "i") },
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

    await recordAudit({
      userId: session.userId,
      action: "category.create",
      entityId: newCategory._id.toString(),
      req,
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
  } catch (error) {
    return internalError("create_category_error", error, "Failed to create category", { route: "/api/categories" });
  }
}
