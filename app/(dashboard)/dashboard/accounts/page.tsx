"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  Landmark,
  MoreHorizontal,
  Pencil,
  Plus,
  Receipt,
  Scale,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiClient } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import {
  invalidateFinancialData,
  useAccounts,
  useCurrentUser,
  type AccountSummary,
} from "@/lib/api/queries";
import { formatCurrency, isValidCurrency } from "@/lib/currency/currencies";
import { ACCOUNT_TYPE_LABELS } from "@/lib/accounts/labels";
import { cn } from "@/lib/utils";

const AccountDialog = dynamic(
  () => import("@/components/accounts/AccountDialog").then((m) => m.AccountDialog),
  { ssr: false }
);

export default function AccountsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const { data: sheet, isLoading, isError, refetch } = useAccounts();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AccountSummary | null>(null);
  const [deleting, setDeleting] = useState<AccountSummary | null>(null);
  const [busy, setBusy] = useState(false);

  // Support /dashboard/accounts?new=1 (command palette, onboarding)
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setEditing(null);
      setDialogOpen(true);
      router.replace("/dashboard/accounts");
    }
  }, [searchParams, router]);

  const currency = isValidCurrency(sheet?.currency)
    ? sheet.currency
    : isValidCurrency(user?.preferredCurrency)
      ? user.preferredCurrency
      : "USD";
  const accounts = sheet?.accounts ?? [];
  const active = accounts.filter((a) => !a.isArchived);
  const archived = accounts.filter((a) => a.isArchived);

  const setArchived = async (account: AccountSummary, isArchived: boolean) => {
    try {
      await apiClient.put(`/accounts/${account.id}`, {
        name: account.name,
        type: account.type,
        currency: account.currency,
        openingBalance: account.openingBalance,
        color: account.color,
        isArchived,
      });
      toast.success(isArchived ? `${account.name} archived` : `${account.name} restored`);
      await invalidateFinancialData(queryClient);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      const res = await apiClient.delete(`/accounts/${deleting.id}`);
      const moved = res.data.unassignedTransactions as number;
      toast.success(`${deleting.name} deleted`, {
        description: moved
          ? `${moved} transaction${moved === 1 ? " was" : "s were"} kept and marked as unassigned.`
          : undefined,
      });
      setDeleting(null);
      await invalidateFinancialData(queryClient);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts"
        description="Balances across your bank accounts, cards, cash and investments."
        actions={
          <Button onClick={openNew} size="sm">
            <Plus className="h-4 w-4" />
            Add account
          </Button>
        }
      />

      {isError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-expense/30 bg-expense-light p-4 text-sm text-main">
          Account balances could not be loaded.
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      )}

      {/* Balance sheet */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : sheet ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            title="Net worth"
            amount={sheet.netWorth}
            currency={currency}
            icon={<Scale className="h-5 w-5 text-primary" />}
            iconBgColor="bg-primary-light"
            type="savings"
          />
          <StatCard
            title="Assets"
            amount={sheet.assets}
            currency={currency}
            icon={<TrendingUp className="h-5 w-5 text-income" />}
            iconBgColor="bg-income-light"
            type="income"
          />
          <StatCard
            title="Liabilities"
            amount={sheet.liabilities}
            currency={currency}
            icon={<TrendingDown className="h-5 w-5 text-expense" />}
            iconBgColor="bg-expense-light"
            type="expense"
          />
        </div>
      ) : null}

      {sheet?.isEstimate && (
        <p className="rounded-lg bg-warning-light px-3 py-2 text-xs text-warning-foreground">
          Live exchange rates are unavailable — converted totals use estimated rates.
        </p>
      )}

      {/* Accounts list */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-xl border border-border bg-white shadow-card">
          <EmptyState
            icon={<Landmark className="h-6 w-6" />}
            title="Add your first account"
            description="Link transactions to accounts to see real balances and your net worth. Existing transactions keep working without one."
            actionLabel="Add account"
            onAction={openNew}
          />
        </div>
      ) : (
        <section aria-labelledby="active-accounts" className="space-y-3">
          <h3 id="active-accounts" className="text-sm font-semibold text-main">
            Active accounts <span className="font-normal text-muted-foreground">({active.length})</span>
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {active.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                preferred={currency}
                onEdit={() => {
                  setEditing(account);
                  setDialogOpen(true);
                }}
                onArchive={() => void setArchived(account, true)}
                onDelete={() => setDeleting(account)}
              />
            ))}
          </div>
        </section>
      )}

      {sheet && sheet.unassignedBalance !== 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border-strong bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-main">Transactions without an account</p>
            <p className="text-xs text-muted-foreground">
              Net{" "}
              <span className="font-semibold tabular-nums text-main">
                {formatCurrency(sheet.unassignedBalance, currency)}
              </span>{" "}
              is included in your net worth. Assign them to accounts from the Transactions page.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/transactions?accountId=unassigned">Review transactions</Link>
          </Button>
        </div>
      )}

      {archived.length > 0 && (
        <section aria-labelledby="archived-accounts" className="space-y-3">
          <h3 id="archived-accounts" className="text-sm font-semibold text-muted-foreground">
            Archived ({archived.length})
          </h3>
          <div className="grid grid-cols-1 gap-4 opacity-80 md:grid-cols-2 xl:grid-cols-3">
            {archived.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                preferred={currency}
                onEdit={() => {
                  setEditing(account);
                  setDialogOpen(true);
                }}
                onArchive={() => void setArchived(account, false)}
                onDelete={() => setDeleting(account)}
              />
            ))}
          </div>
        </section>
      )}

      {dialogOpen && (
        <AccountDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          account={editing}
          defaultCurrency={currency}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "account"}?`}
        description="The account is removed. Its transactions are kept and become unassigned, so your history and totals stay intact. Archive instead if you only want to hide it."
        confirmLabel="Delete account"
        isDestructive
        isLoading={busy}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

function AccountCard({
  account,
  preferred,
  onEdit,
  onArchive,
  onDelete,
}: {
  account: AccountSummary;
  preferred: string;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const negative = account.balance < 0;
  return (
    <article className="group relative flex flex-col rounded-xl border border-border bg-white p-5 shadow-card transition-shadow hover:shadow-card-hover">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ backgroundColor: account.color }}
            aria-hidden="true"
          >
            <Landmark className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-main">{account.name}</h4>
            <p className="text-xs text-muted-foreground">
              {ACCOUNT_TYPE_LABELS[account.type]} · {account.currency}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${account.name}`}>
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem asChild className="cursor-pointer gap-2">
              <Link href={`/dashboard/transactions?accountId=${account.id}`}>
                <Receipt className="h-4 w-4 text-muted-foreground" /> Transactions
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit} className="cursor-pointer gap-2">
              <Pencil className="h-4 w-4 text-muted-foreground" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onArchive} className="cursor-pointer gap-2">
              {account.isArchived ? (
                <ArchiveRestore className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Archive className="h-4 w-4 text-muted-foreground" />
              )}
              {account.isArchived ? "Restore" : "Archive"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="cursor-pointer gap-2 text-expense-text focus:bg-expense-light focus:text-expense-text"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-5">
        <p className="text-xs text-muted-foreground">Current balance</p>
        <p className={cn("text-2xl font-semibold tracking-tight tabular-nums", negative ? "text-expense-text" : "text-main")}>
          {formatCurrency(account.balance, account.currency)}
        </p>
        {account.currency !== preferred && (
          <p className="text-xs tabular-nums text-muted-foreground">
            ≈ {formatCurrency(account.convertedBalance, preferred)}
          </p>
        )}
      </div>
      {account.isArchived && (
        <Badge variant="secondary" className="absolute bottom-5 right-5">
          Archived
        </Badge>
      )}
    </article>
  );
}
