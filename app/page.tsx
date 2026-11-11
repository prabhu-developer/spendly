
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import {
  ArrowUpRight,
  ChartNoAxesCombined,
  Globe,
  Receipt,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await getCurrentUser();

  if (session && session.userId) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted">
      {/* Navigation */}
      <header className="border-b border-border bg-white">
        <nav className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
              <Wallet size={19} strokeWidth={2} />
            </div>
            <span className="text-xl font-semibold tracking-tight text-main">
              Spendly
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button
                variant="ghost"
                className="text-sm font-medium text-main"
              >
                Sign in
              </Button>
            </Link>

            <Link href="/register">
              <Button className="bg-primary text-sm font-medium hover:bg-primary-hover">
                Get started
              </Button>
            </Link>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <section className="mx-auto w-full max-w-7xl px-4 pb-16 pt-20 text-center sm:px-8 sm:pb-24 sm:pt-28">

          {/* Hero */}
          <div className="mx-auto max-w-5xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-xs font-medium text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-income" />
              A simpler way to manage your money
            </div>

            <h1 className="mx-auto max-w-4xl text-4xl font-bold leading-[1.15] tracking-tight text-main sm:text-5xl lg:text-6xl">
              Know where your money goes. Plan where it should go.
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Keep your income, spending and monthly budgets in one place.
              Spendly makes it easier to stay on top of your finances without
              the usual hassle.
            </p>

            {/* Actions */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/register">
                <Button
                  size="lg"
                  className="gap-2 bg-primary px-6 font-medium hover:bg-primary-hover"
                >
                  Create your account
                  <ArrowUpRight size={17} />
                </Button>
              </Link>

              <Link href="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-border bg-white px-6 font-medium text-main"
                >
                  Sign in
                </Button>
              </Link>
            </div>
          </div>

          {/* Features */}
          <div className="mx-auto mt-24 max-w-6xl border-t border-border pt-12">
            <div className="mb-10 text-center">
              <h2 className="text-xl font-semibold text-main">
                Everything you need to stay organised
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                The everyday tools to make managing money a little easier.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">

              {/* Feature 1 */}
              <div className="rounded-lg border border-border bg-white p-6 transition-shadow hover:shadow-sm">
                <Receipt className="mb-5 h-5 w-5 text-primary-text" />

                <h3 className="font-semibold text-main">
                  Track your spending
                </h3>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Add income and expenses, find past transactions and see
                  where your money is going.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="rounded-lg border border-border bg-white p-6 transition-shadow hover:shadow-sm">
                <ChartNoAxesCombined className="mb-5 h-5 w-5 text-income-text" />

                <h3 className="font-semibold text-main">
                  Keep budgets in check
                </h3>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Set monthly spending limits and keep an eye on categories
                  that need attention.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="rounded-lg border border-border bg-white p-6 transition-shadow hover:shadow-sm">
                <Globe className="mb-5 h-5 w-5 text-primary-text" />

                <h3 className="font-semibold text-main">
                  Multiple currencies
                </h3>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Work with 10 currencies, including INR, USD, EUR and GBP,
                  with exchange rate conversion.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="rounded-lg border border-border bg-white p-6 transition-shadow hover:shadow-sm">
                <ShieldCheck className="mb-5 h-5 w-5 text-income-text" />

                <h3 className="font-semibold text-main">
                  Your data stays yours
                </h3>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Secure sign-in, protected passwords and private financial
                  records for every account.
                </p>
              </div>

            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
