"use client";

import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api/errors";
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
import { AVAILABLE_ICONS, PRESET_COLORS } from "@/lib/categories/constants";
import { useQuery } from "@tanstack/react-query";
import { Edit2, Plus, Trash2, } from "lucide-react";
import React, { useState } from "react";


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
      toast.success(editingCategory ? "Category updated" : "Category added");
      refetch();
    } catch (err: any) {
      setFormError(getErrorMessage(err, "Failed to save category"));
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
      toast.success("Category deleted");
      refetch();
    } catch (err: any) {
      toast.error(getErrorMessage(err, "Failed to delete category"));
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
          <h2 className="text-xl font-semibold tracking-tight text-main">Categories</h2>
          <p className="text-xs text-muted-foreground">
            Organize transactions with default and custom categories, custom icons, and colors.
          </p>
        </div>

        <Button
          onClick={openCreateDialog}
          className="gap-1.5 bg-primary hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" />
          Add Category
        </Button>
      </div>

      {/* Type Toggle Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          onClick={() => setActiveTab("expense")}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${activeTab === "expense"
            ? "bg-primary text-white"
            : "bg-white text-muted-foreground hover:text-main border border-border"
            }`}
        >
          Expense Categories
        </button>
        <button
          onClick={() => setActiveTab("income")}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${activeTab === "income"
            ? "bg-primary text-white"
            : "bg-white text-muted-foreground hover:text-main border border-border"
            }`}
        >
          Income Categories
        </button>
      </div>

      {/* Categories Grid */}
      {isLoading ? (
        <div className="py-16 text-center text-xs text-muted-foreground">Loading categories...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredCategories.map((cat: any) => (
            <Card
              key={cat.id}
              className="border border-border bg-white transition-all hover:shadow-sm"
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
                    <h3 className="text-sm font-semibold text-main">{cat.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] capitalize text-muted-foreground">{cat.type}</span>
                      {cat.isSystem && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
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
                    className="h-8 w-8 text-muted-foreground hover:text-primary-text"
                    onClick={() => openEditDialog(cat)}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-expense-text"
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
              <div className="rounded-lg bg-expense-light p-3 text-xs text-expense-text">
                {formError}
              </div>
            )}

            {/* Type */}
            <div className="space-y-1.5">
              <Label>Category Type</Label>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
                <button
                  type="button"
                  onClick={() => setType("expense")}
                  className={`rounded-md py-1.5 text-xs font-semibold ${type === "expense"
                    ? "bg-white text-expense-text shadow-sm"
                    : "text-muted-foreground"
                    }`}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => setType("income")}
                  className={`rounded-md py-1.5 text-xs font-semibold ${type === "income"
                    ? "bg-white text-income-text shadow-sm"
                    : "text-muted-foreground"
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
              <div className="grid grid-cols-7 gap-2 rounded-lg border border-border p-2 max-h-32 overflow-y-auto">
                {AVAILABLE_ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setIcon(ic)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all ${icon === ic
                      ? "border-primary bg-primary-light text-primary-text"
                      : "border-transparent text-muted-foreground hover:bg-muted"
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
                    className={`h-7 w-7 rounded-full border-2 transition-transform ${color === c ? "scale-110 border-main" : "border-transparent"
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
                className="bg-primary hover:bg-primary-hover"
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
