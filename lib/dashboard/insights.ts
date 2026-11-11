export type InsightTone = "positive" | "warning" | "neutral";

export interface Insight {
  id: string;
  tone: InsightTone;
  title: string;
  detail: string;
}

export interface InsightInput {
  totalIncome: number;
  totalExpenses: number;
  savingsRate: number;
  expensesChange: number;
  incomeChange: number;
  topCategory?: { name: string; percentage: number } | null;
  budgets?: { exceeded: number; nearing: number; total: number };
  dayOfMonth: number;
  daysInMonth: number;
  formatMoney: (n: number) => string;
}

const SAVINGS_TARGET = 20;

/**
 * Derive plain-language insights from real period totals. Returns at most `limit`
 * items, most important first. Never invents numbers — every statement maps to an input.
 */
export function buildInsights(input: InsightInput, limit = 4): Insight[] {
  const out: (Insight & { weight: number })[] = [];
  const { totalIncome, totalExpenses, savingsRate, expensesChange, formatMoney } = input;
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

  if (input.budgets && input.budgets.exceeded > 0) {
    const n = input.budgets.exceeded;
    out.push({
      id: "budgets-exceeded",
      tone: "warning",
      weight: 100,
      title: n + plural(n, " budget is", " budgets are") + " over the limit",
      detail: "Review the categories that went over this month.",
    });
  } else if (input.budgets && input.budgets.nearing > 0) {
    const n = input.budgets.nearing;
    out.push({
      id: "budgets-nearing",
      tone: "warning",
      weight: 70,
      title: n + plural(n, " budget is", " budgets are") + " above 80%",
      detail: "You're close to the limit on these categories.",
    });
  }

  if (totalIncome > 0) {
    if (savingsRate >= SAVINGS_TARGET) {
      out.push({
        id: "savings-good",
        tone: "positive",
        weight: 40,
        title: "You're saving " + savingsRate + "% of your income",
        detail: "That's at or above the " + SAVINGS_TARGET + "% guideline. Keep it up.",
      });
    } else if (savingsRate < 0) {
      out.push({
        id: "savings-negative",
        tone: "warning",
        weight: 90,
        title: "Spending is higher than income this month",
        detail: "You've spent " + formatMoney(totalExpenses - totalIncome) + " more than you earned.",
      });
    } else {
      const gap = (totalIncome * SAVINGS_TARGET) / 100 - (totalIncome - totalExpenses);
      out.push({
        id: "savings-low",
        tone: "neutral",
        weight: 50,
        title: "Savings rate is " + savingsRate + "%",
        detail: "Saving " + formatMoney(gap) + " more would reach " + SAVINGS_TARGET + "%.",
      });
    }
  }

  if (expensesChange >= 15) {
    out.push({
      id: "expenses-up",
      tone: "warning",
      weight: 60,
      title: "Spending is up " + Math.round(expensesChange) + "% vs last period",
      detail: "Compare categories in Reports to see what changed.",
    });
  } else if (expensesChange <= -10) {
    out.push({
      id: "expenses-down",
      tone: "positive",
      weight: 45,
      title: "Spending is down " + Math.abs(Math.round(expensesChange)) + "% vs last period",
      detail: "Your expenses are lower than the previous period.",
    });
  }

  if (input.topCategory && input.topCategory.percentage >= 30) {
    out.push({
      id: "top-category",
      tone: "neutral",
      weight: 35,
      title: input.topCategory.name + " is " + Math.round(input.topCategory.percentage) + "% of spending",
      detail: "Your largest category this period.",
    });
  }

  if (totalExpenses > 0 && input.dayOfMonth >= 5 && input.dayOfMonth < input.daysInMonth) {
    const projected = (totalExpenses / input.dayOfMonth) * input.daysInMonth;
    out.push({
      id: "projection",
      tone: "neutral",
      weight: 20,
      title: "On pace to spend " + formatMoney(projected) + " this month",
      detail: "Based on " + input.dayOfMonth + " days of spending so far.",
    });
  }

  return out
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
    .map(({ weight: _weight, ...insight }) => insight);
}
