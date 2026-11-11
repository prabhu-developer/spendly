import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const unique = () => Math.random().toString(36).slice(2, 8);

async function register(page: Page) {
  const email = `e2e-${unique()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Full Name").fill("E2E Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Sup3r-Secret-Pass!");
  const confirm = page.getByLabel(/confirm password/i);
  if (await confirm.count()) await confirm.fill("Sup3r-Secret-Pass!");
  await page.getByRole("button", { name: /create|sign up|register/i }).click();
  await page.waitForURL("**/dashboard");
  return email;
}

async function addTransaction(page: Page, title: string, amount: string, opts: { account?: string } = {}) {
  await page.goto("/dashboard/transactions/new");
  await page.getByLabel("Title / Description").fill(title);
  await page.getByLabel("Amount").fill(amount);
  if (opts.account) {
    await page.getByLabel("Account (optional)").click();
    await page.getByRole("option", { name: new RegExp(opts.account) }).click();
  }
  await page.getByRole("button", { name: "Add Transaction" }).click();
}

test.describe("Spendly core flows", () => {
  test("register → onboarding → account → transaction → table, filters, bulk delete", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));

    await register(page);
    await expect(page.getByRole("heading", { name: "Financial overview" })).toBeVisible();
    await expect(page.getByText("Get started with Spendly")).toBeVisible();

    // Create an account
    await page.goto("/dashboard/accounts");
    await page.getByRole("button", { name: "Add account" }).first().click();
    await page.getByLabel("Name").fill("Everyday Checking");
    await page.getByLabel("Opening balance").fill("1000");
    await page.getByRole("button", { name: "Add account" }).last().click();
    await expect(page.getByText("Account added")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Everyday Checking" })).toBeVisible();

    // Add transactions (one linked to the account)
    await addTransaction(page, "Groceries run", "42.50", { account: "Everyday Checking" });
    await expect(page.getByText("Transaction added").first()).toBeVisible();
    await addTransaction(page, "Coffee (Starbucks)", "4.75");
    await expect(page.getByText("Transaction added").first()).toBeVisible();

    // Account balance reflects the linked expense
    await page.goto("/dashboard/accounts");
    await expect(page.getByText("$957.50").first()).toBeVisible();

    // Table + URL-synced search (with regex metacharacters)
    await page.goto("/dashboard/transactions");
    await expect(page.getByText("2 transactions")).toBeVisible();
    await page.getByLabel("Search transactions").fill("(Starbucks)");
    await expect(page).toHaveURL(/search=%28Starbucks%29/);
    await expect(page.getByText("1 transaction", { exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: /Coffee \(Starbucks\)/ })).toBeVisible();

    // Drill-down style URL with account filter
    await page.getByRole("button", { name: "Clear all" }).click();
    await expect(page.getByText("2 transactions")).toBeVisible();

    // Bulk select + delete with confirmation
    await page.getByLabel("Select all on this page").check();
    await expect(page.getByText("2 selected")).toBeVisible();
    await page.getByRole("region", { name: "Bulk actions" }).getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete 2" }).click();
    await expect(page.getByText("Deleted 2 transactions")).toBeVisible();
    await expect(page.getByText("No transactions yet")).toBeVisible();

    // No CSP or runtime errors
    expect(consoleErrors.filter((e) => /Content Security Policy|Uncaught|hydration/i.test(e))).toEqual([]);
  });

  test("command palette and keyboard shortcuts", async ({ page }) => {
    await register(page);
    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog");
    await expect(palette.getByRole("combobox")).toBeFocused();
    await page.keyboard.type("reports");
    await page.keyboard.press("Enter");
    await page.waitForURL("**/dashboard/reports");
    await expect(page.getByRole("heading", { name: /report/i }).first()).toBeVisible();

    await page.keyboard.press("g");
    await page.keyboard.press("a");
    await page.waitForURL("**/dashboard/accounts");
  });

  test("offline: transaction saved as draft and synced on reconnect", async ({ page, context }) => {
    await register(page);
    await page.goto("/dashboard/transactions/new");
    await expect(page.getByLabel("Title / Description")).toBeVisible();

    await context.setOffline(true);
    await page.getByLabel("Title / Description").fill("Offline taxi");
    await page.getByLabel("Amount").fill("18");
    await page.getByRole("button", { name: "Add Transaction" }).click();
    await expect(page.getByText("Saved offline").first()).toBeVisible();

    await context.setOffline(false);
    // Auto-sync on reconnect; transaction must exist exactly once
    await expect
      .poll(
        async () => {
          const res = await page.request.get("/api/transactions?search=Offline%20taxi");
          return (await res.json()).pagination?.total;
        },
        { timeout: 20_000 }
      )
      .toBe(1);
  });

  test("reports page renders with drill-down links and PWA manifest + service worker", async ({ page }) => {
    await register(page);
    await addTransaction(page, "Monthly rent", "1200");
    await expect(page.getByText("Transaction added").first()).toBeVisible();

    await page.goto("/dashboard/reports");
    await expect(page.getByText("Monthly rent").or(page.getByText(/rent/i)).first()).toBeVisible({ timeout: 15_000 });

    const manifest = await page.request.get("/manifest.webmanifest");
    expect(manifest.ok()).toBeTruthy();
    const json = await manifest.json();
    expect(json.display).toBe("standalone");
    expect(json.icons.length).toBeGreaterThan(0);

    const swActive = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return false;
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((r) => setTimeout(() => r(null), 10_000)),
      ]);
      return Boolean(reg && reg.active);
    });
    expect(swActive).toBe(true);

    // API responses are never cached by the service worker
    const cacheNames = await page.evaluate(() => caches.keys());
    for (const name of cacheNames) {
      const keys = await page.evaluate(async (n) => (await (await caches.open(n)).keys()).map((r) => r.url), name);
      expect(keys.filter((u) => u.includes("/api/"))).toEqual([]);
    }
  });

  test("accessibility: no serious or critical axe violations on key pages", async ({ page }) => {
    await register(page);
    await addTransaction(page, "Lunch", "12");
    await expect(page.getByText("Transaction added").first()).toBeVisible();
    for (const path of ["/dashboard", "/dashboard/transactions", "/dashboard/accounts", "/dashboard/reports", "/dashboard/budgets"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .exclude("[data-sonner-toaster]")
        .analyze();
      const serious = results.violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => `${path}: ${v.id} — ${v.help} (${v.nodes.length})`);
      expect(serious, serious.join("\n")).toEqual([]);
    }
  });
});

test.describe("mobile @mobile", () => {
  test("bottom navigation and card list on phones @mobile", async ({ page }) => {
    await register(page);
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav).toBeVisible();
    await nav.getByRole("link", { name: "Add transaction" }).click();
    await page.waitForURL("**/transactions/new");
    await page.getByLabel("Title / Description").fill("Bus ticket");
    await page.getByLabel("Amount").fill("2.5");
    await page.getByRole("button", { name: "Add Transaction" }).click();
    await expect(page.getByText("Transaction added").first()).toBeVisible();

    await nav.getByRole("link", { name: "Activity" }).click();
    await expect(page.getByText("Bus ticket")).toBeVisible();
    // No horizontal page scroll at phone width
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
