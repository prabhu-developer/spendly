"use client";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { IconRenderer } from "@/components/shared/IconRenderer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api/client";
import { useQuery } from "@tanstack/react-query";
import { Edit2, Plus, Trash2, } from "lucide-react";
import React, { useState } from "react";


export const AVAILABLE_ICONS = [
  // General
  "Tag", "Briefcase", "Laptop", "Building2",
  "TrendingUp", "TrendingDown", "Coins",

  // Finance
  "Wallet", "WalletCards", "Banknote",
  "PiggyBank", "HandCoins", "CircleDollarSign",
  "BadgeDollarSign", "Landmark", "Bank",
  "CreditCard", "Receipt", "ReceiptText",

  // Shopping
  "ShoppingBag", "ShoppingCart", "ShoppingBasket",
  "Store", "Gift", "Package", "Shirt",

  // Food
  "Utensils", "UtensilsCrossed", "Coffee",
  "Pizza", "ChefHat", "ShoppingBasket",
  "IceCreamCone", "Cake",

  // Housing
  "House", "Home", "Building", "Sofa",
  "BedDouble", "Lightbulb", "Droplets",
  "Refrigerator", "WashingMachine",

  // Transport
  "Car", "CarFront", "Bike", "Bus",
  "Train", "Plane", "Fuel", "ParkingCircle",
  "Luggage",

  // Lifestyle
  "Film", "Tv", "Gamepad2", "Music",
  "Headphones", "Camera", "Smartphone",
  "Wifi", "Shirt", "Watch",

  // Health
  "HeartPulse", "Stethoscope", "Pill",
  "Hospital", "Dumbbell", "Activity",

  // Education
  "GraduationCap", "BookOpen", "Book",
  "School", "Library", "Calculator",

  // Income
  "BriefcaseBusiness", "Handshake", "Factory",
  "Globe", "Users", "Award", "Trophy",

  // Bills & subscriptions
  "FileText", "FileSpreadsheet", "CalendarDays",
  "CalendarClock", "Repeat", "Zap", "ShieldCheck",

  // Savings & investments
  "Target", "Bitcoin", "Gem", "ChartPie",
  "ChartLine", "ChartColumn", "Scale",

  // Other
  "Heart", "Dog", "Cat", "Baby",
  "Flower2", "TreePine", "Wrench",
  "Scissors", "MoreHorizontal"
];



export const PRESET_COLORS = [
  // Blues
  "#2878E5",
  "#3B82F6",
  "#1D4ED8",
  "#60A5FA",
  "#0EA5E9",

  // Greens
  "#269B72",
  "#10B981",
  "#059669",
  "#22C55E",
  "#84CC16",

  // Reds & Rose
  "#EF4444",
  "#F07862",
  "#F43F5E",
  "#EC4899",
  "#BE123C",

  // Oranges
  "#F97316",
  "#EA580C",
  "#FB923C",
  "#D97706",
  "#F59E0B",

  // Yellows
  "#E9B949",
  "#EAB308",
  "#FACC15",
  "#CA8A04",

  // Purples & Violets
  "#8B5CF6",
  "#A855F7",
  "#7C3AED",
  "#C084FC",
  "#6D28D9",

  // Cyan & Teal
  "#06B6D4",
  "#0891B2",
  "#14B8A6",
  "#0D9488",
  "#2DD4BF",

  // Neutrals
  "#64748B",
  "#475569",
  "#94A3B8",
  "#78716C",
  "#A8A29E",

  // Special
  "#6366F1",
  "#D946EF",
  "#A3E635",
  "#FB7185",
  "#14B8A6"
];

export default function CategoriesPage() {
  const [activeTab, setActiveTab] = useState<"expense" | "income">("expense");

  // Modal
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form
  const [name, setName] = useState("");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [icon, setIcon] = useState("Tag");
  const [color, setColor] = useState("#2878E5");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: categoriesData, isLoading, refetch } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await apiClient.get("/categories");
      return res.data.categories;
    },
  });

  const categories = categoriesData || [];
  const filteredCategories = categories.filter((c: any) => c.type === activeTab);

  const openCreateDialog = () => {
    setEditingCategory(null);
    setName("");
    setType(activeTab);
    setIcon("Tag");
    setColor("#2878E5");
    setFormError("");
    setDialogOpen(true);
  };

  const openEditDialog = (cat: any) => {
    setEditingCategory(cat);
    setName(cat.name);
    setType(cat.type);
    setIcon(cat.icon || "Tag");
    setColor(cat.color || "#2878E5");
    setFormError("");
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!name.trim()) {
      setFormError("Category name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCategory) {
        await apiClient.put(`/categories/${editingCategory.id}`, {
          name,
          type,
          icon,
          color,
        });
      } else {
        await apiClient.post("/categories", {
          name,
          type,
          icon,
          color,
        });
      }
      setDialogOpen(false);
      refetch();
    } catch (err: any) {
      setFormError(err.response?.data?.error || "Failed to save category");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/categories/${deleteTargetId}`);
      setDeleteTargetId(null);
      refetch();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to delete category");
      setDeleteTargetId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Add Button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#202735]">Categories</h2>
          <p className="text-xs text-[#8992A3]">
            Organize transactions with default and custom categories, custom icons, and colors.
          </p>
        </div>

        <Button
          onClick={openCreateDialog}
          className="gap-1.5 bg-[#2878E5] hover:bg-[#1F65C2]"
        >
          <Plus className="h-4 w-4" />
          Add Category
        </Button>
      </div>

      {/* Type Toggle Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E8EDF4] pb-3">
        <button
          onClick={() => setActiveTab("expense")}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${activeTab === "expense"
            ? "bg-[#2878E5] text-white"
            : "bg-white text-[#8992A3] hover:text-[#202735] border border-[#E8EDF4]"
            }`}
        >
          Expense Categories
        </button>
        <button
          onClick={() => setActiveTab("income")}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${activeTab === "income"
            ? "bg-[#2878E5] text-white"
            : "bg-white text-[#8992A3] hover:text-[#202735] border border-[#E8EDF4]"
            }`}
        >
          Income Categories
        </button>
      </div>

      {/* Categories Grid */}
      {isLoading ? (
        <div className="py-16 text-center text-xs text-[#8992A3]">Loading categories...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredCategories.map((cat: any) => (
            <Card
              key={cat.id}
              className="border border-[#E8EDF4] bg-white transition-all hover:shadow-sm"
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: `${cat.color}15`,
                      color: cat.color,
                    }}
                  >
                    <IconRenderer name={cat.icon || "Tag"} className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#202735]">{cat.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] capitalize text-[#8992A3]">{cat.type}</span>
                      {cat.isSystem && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-[#8992A3]">
                          &bull; Default
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-[#8992A3] hover:text-[#2878E5]"
                    onClick={() => openEditDialog(cat)}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-[#8992A3] hover:text-[#F07862]"
                    onClick={() => setDeleteTargetId(cat.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "New Category"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {formError && (
              <div className="rounded-lg bg-[#FDF1EE] p-3 text-xs text-[#F07862]">
                {formError}
              </div>
            )}

            {/* Type */}
            <div className="space-y-1.5">
              <Label>Category Type</Label>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-[#F3F6FC] p-1">
                <button
                  type="button"
                  onClick={() => setType("expense")}
                  className={`rounded-md py-1.5 text-xs font-semibold ${type === "expense"
                    ? "bg-white text-[#F07862] shadow-sm"
                    : "text-[#8992A3]"
                    }`}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => setType("income")}
                  className={`rounded-md py-1.5 text-xs font-semibold ${type === "income"
                    ? "bg-white text-[#269B72] shadow-sm"
                    : "text-[#8992A3]"
                    }`}
                >
                  Income
                </button>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="catName">Category Name</Label>
              <Input
                id="catName"
                placeholder="e.g. Groceries, Dividends"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Icon Picker */}
            <div className="space-y-1.5">
              <Label>Icon</Label>
              <div className="grid grid-cols-7 gap-2 rounded-lg border border-[#E8EDF4] p-2 max-h-32 overflow-y-auto">
                {AVAILABLE_ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setIcon(ic)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all ${icon === ic
                      ? "border-[#2878E5] bg-[#EBF3FC] text-[#2878E5]"
                      : "border-transparent text-[#8992A3] hover:bg-[#F3F6FC]"
                      }`}
                  >
                    <IconRenderer name={ic} className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>

            {/* Color Picker */}
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-7 w-7 rounded-full border-2 transition-transform ${color === c ? "scale-110 border-[#202735]" : "border-transparent"
                      }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#2878E5] hover:bg-[#1F65C2]"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : editingCategory ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
        title="Delete Category"
        description="Are you sure you want to delete this category? If any existing transactions are associated with this category, deletion will be safely rejected."
        confirmLabel="Delete"
        isDestructive
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
