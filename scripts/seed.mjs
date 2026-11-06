import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Safe fallback for demo seeding
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/spendly";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "spendly";

const DEFAULT_CATEGORIES = [
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

async function seed() {
  console.log("Connecting to MongoDB at:", MONGODB_URI);
  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB_NAME });
  console.log("Connected successfully!");

  const db = mongoose.connection.db;

  // 1. Create or retrieve demo user
  const demoEmail = "demo@spendly.app";
  let user = await db.collection("users").findOne({ email: demoEmail });

  if (!user) {
    console.log("Creating demo user: demo@spendly.app ...");
    const passwordHash = await bcrypt.hash("Password123", 12);
    const result = await db.collection("users").insertOne({
      name: "Demo User",
      email: demoEmail,
      passwordHash,
      preferredCurrency: "USD",
      dateFormat: "MM/dd/yyyy",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    user = { _id: result.insertedId, name: "Demo User", email: demoEmail };
  } else {
    console.log("Demo user already exists:", user._id);
  }

  // 2. Seed Categories
  const existingCategories = await db
    .collection("categories")
    .find({ userId: user._id })
    .toArray();

  let categoryMap = new Map();
  if (existingCategories.length === 0) {
    console.log("Seeding default categories for demo user...");
    const catDocs = DEFAULT_CATEGORIES.map((c) => ({
      userId: user._id,
      name: c.name,
      type: c.type,
      icon: c.icon,
      color: c.color,
      isSystem: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    const catResult = await db.collection("categories").insertMany(catDocs);
    const inserted = await db
      .collection("categories")
      .find({ userId: user._id })
      .toArray();
    for (const c of inserted) {
      categoryMap.set(c.name, c._id);
    }
  } else {
    for (const c of existingCategories) {
      categoryMap.set(c.name, c._id);
    }
  }

  // 3. Seed Monthly Budgets
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const foodCatId = categoryMap.get("Food");
  const transportCatId = categoryMap.get("Transport");
  const shoppingCatId = categoryMap.get("Shopping");
  const billsCatId = categoryMap.get("Bills");

  const sampleBudgets = [
    { categoryId: foodCatId, amount: 600, currency: "USD", month: currentMonth, year: currentYear },
    { categoryId: transportCatId, amount: 200, currency: "USD", month: currentMonth, year: currentYear },
    { categoryId: shoppingCatId, amount: 400, currency: "USD", month: currentMonth, year: currentYear },
    { categoryId: billsCatId, amount: 350, currency: "USD", month: currentMonth, year: currentYear },
  ].filter((b) => b.categoryId);

  for (const b of sampleBudgets) {
    await db.collection("budgets").updateOne(
      { userId: user._id, categoryId: b.categoryId, month: b.month, year: b.year },
      { $set: { ...b, userId: user._id, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
  }
  console.log("Seeded sample category budgets for current month.");

  // 4. Seed sample transactions spanning past 6 months if none exist
  const txCount = await db.collection("transactions").countDocuments({ userId: user._id });
  if (txCount === 0) {
    console.log("Seeding sample transactions across last 6 months...");
    const sampleTransactions = [];

    // Past 6 months
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 15);
      const mSalaryDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mFreelanceDate = new Date(now.getFullYear(), now.getMonth() - i, 20);

      // Salary
      if (categoryMap.get("Salary")) {
        sampleTransactions.push({
          userId: user._id,
          title: "Monthly Salary",
          amount: 5500,
          currency: "USD",
          type: "income",
          categoryId: categoryMap.get("Salary"),
          date: mSalaryDate,
          paymentMethod: "Bank Transfer",
          notes: "Direct deposit payroll",
          exchangeRateSnapshot: { base: "USD", rateToUSD: 1, rateDate: mSalaryDate.toISOString() },
          createdAt: mSalaryDate,
          updatedAt: mSalaryDate,
        });
      }

      // Freelance
      if (categoryMap.get("Freelance")) {
        sampleTransactions.push({
          userId: user._id,
          title: "Web Consulting",
          amount: 1200,
          currency: "USD",
          type: "income",
          categoryId: categoryMap.get("Freelance"),
          date: mFreelanceDate,
          paymentMethod: "UPI",
          notes: "Client sprint milestone",
          exchangeRateSnapshot: { base: "USD", rateToUSD: 1, rateDate: mFreelanceDate.toISOString() },
          createdAt: mFreelanceDate,
          updatedAt: mFreelanceDate,
        });
      }

      // Food
      if (foodCatId) {
        sampleTransactions.push({
          userId: user._id,
          title: "Whole Foods Groceries",
          amount: 245.8,
          currency: "USD",
          type: "expense",
          categoryId: foodCatId,
          date: new Date(now.getFullYear(), now.getMonth() - i, 5),
          paymentMethod: "Credit Card",
          notes: "Weekly pantry and fresh produce",
          exchangeRateSnapshot: { base: "USD", rateToUSD: 1, rateDate: monthDate.toISOString() },
          createdAt: monthDate,
          updatedAt: monthDate,
        });
      }

      // Transport
      if (transportCatId) {
        sampleTransactions.push({
          userId: user._id,
          title: "Metro Card & Fuel",
          amount: 110.0,
          currency: "USD",
          type: "expense",
          categoryId: transportCatId,
          date: new Date(now.getFullYear(), now.getMonth() - i, 12),
          paymentMethod: "Debit Card",
          notes: "Commuting expenses",
          exchangeRateSnapshot: { base: "USD", rateToUSD: 1, rateDate: monthDate.toISOString() },
          createdAt: monthDate,
          updatedAt: monthDate,
        });
      }

      // Bills
      if (billsCatId) {
        sampleTransactions.push({
          userId: user._id,
          title: "High-Speed Fiber Internet",
          amount: 75.0,
          currency: "USD",
          type: "expense",
          categoryId: billsCatId,
          date: new Date(now.getFullYear(), now.getMonth() - i, 18),
          paymentMethod: "Credit Card",
          notes: "Monthly utility bill",
          exchangeRateSnapshot: { base: "USD", rateToUSD: 1, rateDate: monthDate.toISOString() },
          createdAt: monthDate,
          updatedAt: monthDate,
        });
      }

      // Shopping
      if (shoppingCatId) {
        sampleTransactions.push({
          userId: user._id,
          title: "Books & Ergonomic Keyboard",
          amount: 180.5,
          currency: "USD",
          type: "expense",
          categoryId: shoppingCatId,
          date: new Date(now.getFullYear(), now.getMonth() - i, 22),
          paymentMethod: "Credit Card",
          notes: "Home office upgrade",
          exchangeRateSnapshot: { base: "USD", rateToUSD: 1, rateDate: monthDate.toISOString() },
          createdAt: monthDate,
          updatedAt: monthDate,
        });
      }
    }

    await db.collection("transactions").insertMany(sampleTransactions);
    console.log(`Seeded ${sampleTransactions.length} sample transactions!`);
  }

  console.log("\n================================================");
  console.log("Demo seed complete!");
  console.log("Demo User credentials:");
  console.log("  Email:    demo@spendly.app");
  console.log("  Password: Password123");
  console.log("================================================\n");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
