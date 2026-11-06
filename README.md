# Spendly — Full-Stack Personal Finance Management App

Spendly is an open-source, production-minded personal finance management application engineered with Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui, and MongoDB Atlas. It empowers individuals and freelancers to track multi-currency cash flows, enforce category budgets, analyze spending trends, and manage finances with real-time exchange rates.

Created by **[Prabhu](https://prabhu-coder.netlify.app/)**.

---

## Screenshots

> *Screenshots section with placeholders clearly marked for later replacement:*

| Financial Overview Dashboard | Multi-Currency Transactions |
| :---: | :---: |
| ![Dashboard Overview Placeholder](https://placehold.co/800x450/F3F6FC/2878E5?text=Spendly+Overview+Dashboard) | ![Transactions CRUD Placeholder](https://placehold.co/800x450/F3F6FC/2878E5?text=Spendly+Transactions+Table) |
| *Interactive KPI cards, monthly trends, and expense breakdown* | *Paginated transactions with type, category, and date filtering* |

| Monthly Category Budgets | Financial Reports & PDF Export |
| :---: | :---: |
| ![Budgets Tracking Placeholder](https://placehold.co/800x450/F3F6FC/2878E5?text=Spendly+Monthly+Budgets) | ![Reports Analytics Placeholder](https://placehold.co/800x450/F3F6FC/2878E5?text=Spendly+Reports+%26+Analytics) |
| *Spending limits with visual progress & threshold warnings* | *Income vs Expense comparisons, savings ratios, & trends* |

---

## Key Features

- **Authentication & Security**:
  - Secure registration and login with bcrypt salted password hashing (work factor 12).
  - Server-side session verification via cryptographically signed JWTs stored in `HttpOnly`, `SameSite=Lax`, `Secure` cookies.
  - Brute-force and spam rate limiting on sensitive authentication endpoints.
  - Zero client-side storage of authentication tokens in `localStorage`.
  - Immediate authenticated access upon registration.
- **Multi-User Data Isolation**:
  - Every transaction, category, and budget is strictly bound to the authenticated user ID extracted from verified server-side cookies.
  - Compound indexes (`userId`, `date`, `categoryId`) for fast multi-tenant database queries.
  - Full ownership validation on all reads, mutations, and deletions.
- **Dynamic Multi-Currency Management**:
  - Full support for **10 currencies**: `INR`, `USD`, `EUR`, `GBP`, `AED`, `SGD`, `CAD`, `AUD`, `JPY`, and `SAR`.
  - Locale-aware currency formatting using `Intl.NumberFormat`.
  - Real-time exchange rate engine with automatic 1-hour in-memory caching and failover mechanisms.
  - Historical exchange-rate snapshot recorded on every transaction.
  - Global preference dynamically converts all summaries, reports, and budgets.
- **Dashboard Overview**:
  - Summary KPI cards: Total Balance, Total Income, Total Expenses, and Net Savings with previous-period comparison percentages.
  - Interactive Recharts visualizations: Income vs Expense bar chart, category donut breakdown, and monthly cash flow trajectory.
  - Recent transactions list with inline edit and delete modals.
- **Complete Transactions CRUD**:
  - Title, amount, currency, income/expense type, category, payment method (Cash, Credit Card, Debit Card, Bank Transfer, UPI, Other), date, and notes.
  - Real-time text search, type filter, category filter, date-range bounds, column sorting, and pagination.
  - Client and server-side validation with React Hook Form and Zod.
- **Category & Budget Controls**:
  - Pre-seeded default categories for both income and expense types.
  - Create, customize, and edit custom categories with custom icons and color palettes.
  - Safe deletion safeguards preventing accidental removal of categories tied to active transactions.
  - Monthly budget ceilings with automated calculation of amount spent, remaining headroom, and visual warning thresholds (80% warning, 100%+ overrun).
- **Comprehensive Reports**:
  - Custom date-range filtering and quick presets (This Month, Last Month, Last 3 Months).
  - Monthly income vs expense breakdowns, net savings trajectory, savings rate percentages, and print/PDF export readiness.
- **Design & Experience**:
  - Custom refined light-only aesthetic following strict design specifications:
    - App Background: `#F3F6FC`
    - Cards: `#FFFFFF`
    - Primary Accent: `#2878E5` (Hover: `#1F65C2`)
    - Main Text: `#202735`
    - Secondary Text: `#8992A3`
    - Borders: `#E8EDF4`
    - Income: `#269B72`
    - Expense: `#F07862`
    - Warning: `#E9B949`
  - Fully responsive layout for desktop, tablet, and mobile devices.

---

## Technology Stack

- **Framework**: [Next.js 14 (App Router)](https://nextjs.org/)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Database**: [MongoDB Atlas](https://www.mongodb.com/atlas) with [Mongoose](https://mongoosejs.com/)
- **Authentication**: Custom JWT sessions (`jose`) + `bcryptjs` + HTTP-only cookies
- **Validation**: [Zod](https://zod.dev/) & [React Hook Form](https://react-hook-form.com/)
- **Data Fetching**: [TanStack Query v5](https://tanstack.com/query) & [Axios](https://axios-http.com/)
- **Visualizations**: [Recharts](https://recharts.org/)
- **Date Utilities**: [date-fns](https://date-fns.org/)
- **Testing**: [Vitest](https://vitest.dev/) & [Testing Library](https://testing-library.com/)

---

## Project Structure

```
spendly/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   └── dashboard/
│   │       ├── page.tsx               # Overview
│   │       ├── transactions/page.tsx  # Transactions CRUD & filters
│   │       ├── budgets/page.tsx       # Monthly budget targets
│   │       ├── reports/page.tsx       # Reports & analytics
│   │       ├── categories/page.tsx    # Category management
│   │       └── settings/page.tsx      # User preferences & password
│   ├── api/
│   │   ├── auth/                      # Register, Login, Logout, Me
│   │   ├── transactions/              # CRUD endpoints
│   │   ├── categories/                # Category CRUD & integrity check
│   │   ├── budgets/                   # Monthly budgets & calculations
│   │   ├── reports/                   # Aggregated report data
│   │   ├── user/                      # Profile & password endpoints
│   │   └── exchange-rates/            # Currency exchange API
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                       # Landing page
├── components/
│   ├── layout/                        # Sidebar, Header, Footer, Shell
│   ├── providers/                     # React Query provider
│   ├── shared/                        # StatCard, EmptyState, ConfirmDialog, IconRenderer
│   ├── transactions/                  # Add/Edit Transaction Modal
│   └── ui/                            # shadcn/ui primitives
├── constants/
│   └── defaultCategories.ts           # Predefined income/expense categories
├── features/
│   └── dashboard/                     # Charts & Recent Transactions
├── lib/
│   ├── api/                           # Axios client
│   ├── auth/                          # Password hashing, JWT session, rate limiting
│   ├── currency/                      # Currency definitions & exchange rate engine
│   ├── db/                            # Cached MongoDB connection
│   ├── utils/                         # Helper functions & formatting
│   └── validations/                   # Zod schemas (auth, txn, budget, cat)
├── models/
│   ├── User.ts
│   ├── Transaction.ts
│   ├── Category.ts
│   └── Budget.ts
├── test/
│   ├── budget.test.ts
│   ├── currency.test.ts
│   ├── isolation.test.ts
│   ├── password.test.ts
│   ├── session.test.ts
│   └── validations.test.ts
├── .env.example
├── LICENSE
├── package.json
└── tsconfig.json
```

---

## Getting Started

### Prerequisites

- **Node.js**: v18.17+ or v20+ (Node v24 supported)
- **npm** / **yarn** / **pnpm**
- **MongoDB Atlas** account (or local MongoDB instance)

### 1. Clone the repository

```bash
git clone https://github.com/prabhu-developer/spendly
cd spendly
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in the required configuration:

```env
# MongoDB Atlas Connection URI
MONGODB_URI="mongodb+srv://<username>:<password>@cluster.mongodb.net/spendly?retryWrites=true&w=majority"
MONGODB_DB_NAME="spendly"

# Secret string used to sign JWT session cookies (min 32 characters)
AUTH_SECRET="your-super-secret-auth-key-change-this-in-production-min32chars"

# Base URL of your app
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Optional ExchangeRate-API key (if left blank, public live rates from open.er-api.com are used)
EXCHANGE_RATE_API_KEY=""
```

### 4. MongoDB Atlas Setup Instructions

1. Log into your [MongoDB Atlas Console](https://cloud.mongodb.com/).
2. Create a free **M0 Sandbox** or higher cluster.
3. Under **Security > Database Access**, add a database user with `Read and write to any database` privileges.
4. Under **Security > Network Access**, whitelist your IP address (or `0.0.0.0/0` for cloud deployment on Vercel).
5. In your cluster dashboard, click **Connect > Drivers > Node.js** to copy your connection string.
6. Replace `<username>` and `<password>` with your Atlas database credentials and paste into `MONGODB_URI` in `.env`.

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Running Tests & Type Checks

Run all unit and integration tests:

```bash
npm test
```

Run TypeScript strict checks:

```bash
npx tsc --noEmit
```

Run ESLint checks:

```bash
npm run lint
```

Build for production:

```bash
npm run build
```

---

## Deployment on Vercel

Spendly is architected for seamless zero-config deployment to **Vercel**:

1. Push your repository to GitHub.
2. In the [Vercel Dashboard](https://vercel.com/dashboard), click **Add New > Project** and import the `spendly` repository.
3. Under **Environment Variables**, supply:
   - `MONGODB_URI`
   - `MONGODB_DB_NAME`
   - `AUTH_SECRET`
   - `NEXT_PUBLIC_APP_URL`
   - `EXCHANGE_RATE_API_KEY` (optional)
4. Click **Deploy**. Vercel will run the production build (`npm run build`) and launch your application.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Attribution

Created with care by **[Prabhu](https://prabhu-coder.netlify.app/)**.
