export interface DefaultCategoryDef {
  name: string;
  type: "income" | "expense";
  icon: string;
  color: string;
}

export const DEFAULT_CATEGORIES: DefaultCategoryDef[] = [
  // Income
  { name: "Salary", type: "income", icon: "Briefcase", color: "#269B72" },
  { name: "Freelance", type: "income", icon: "Laptop", color: "#2878E5" },
  { name: "Business", type: "income", icon: "Building2", color: "#6366F1" },
  { name: "Investment", type: "income", icon: "TrendingUp", color: "#10B981" },
  { name: "Other Income", type: "income", icon: "Coins", color: "#14B8A6" },

  // Expenses
  { name: "Food", type: "expense", icon: "Utensils", color: "#F07862" },
  { name: "Shopping", type: "expense", icon: "ShoppingBag", color: "#EC4899" },
  { name: "Transport", type: "expense", icon: "Car", color: "#F59E0B" },
  { name: "Bills", type: "expense", icon: "Receipt", color: "#EF4444" },
  { name: "Entertainment", type: "expense", icon: "Film", color: "#8B5CF6" },
  { name: "Health", type: "expense", icon: "HeartPulse", color: "#06B6D4" },
  { name: "Education", type: "expense", icon: "GraduationCap", color: "#3B82F6" },
  { name: "Travel", type: "expense", icon: "Plane", color: "#F97316" },
  { name: "Other Expenses", type: "expense", icon: "MoreHorizontal", color: "#64748B" },
];
