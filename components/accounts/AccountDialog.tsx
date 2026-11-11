"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { invalidateFinancialData, type AccountSummary } from "@/lib/api/queries";
import { accountSchema } from "@/lib/validations/account";
import { CURRENCY_LIST, type SupportedCurrency } from "@/lib/currency/currencies";
import { ACCOUNT_COLORS, ACCOUNT_TYPE_LABELS } from "@/lib/accounts/labels";
import { ACCOUNT_TYPES, LIABILITY_ACCOUNT_TYPES, type AccountType } from "@/lib/accounts/constants";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: AccountSummary | null;
  defaultCurrency: SupportedCurrency;
}

export function AccountDialog({ open, onOpenChange, account, defaultCurrency }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [currency, setCurrency] = useState<SupportedCurrency>(defaultCurrency);
  const [openingBalance, setOpeningBalance] = useState("0");
  const [color, setColor] = useState(ACCOUNT_COLORS[0]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(account?.name ?? "");
    setType(account?.type ?? "checking");
    setCurrency(account?.currency ?? defaultCurrency);
    setOpeningBalance(String(account?.openingBalance ?? 0));
    setColor(account?.color ?? ACCOUNT_COLORS[0]);
    setErrors({});
    setSubmitError("");
  }, [open, account, defaultCurrency]);

  const isLiability = LIABILITY_ACCOUNT_TYPES.includes(type);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    const parsed = accountSchema.safeParse({
      name,
      type,
      currency,
      openingBalance: openingBalance.trim() === "" ? 0 : Number(openingBalance),
      color,
      isArchived: account?.isArchived ?? false,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      if (account) await apiClient.put(`/accounts/${account.id}`, parsed.data);
      else await apiClient.post("/accounts", parsed.data);
      toast.success(account ? "Account updated" : "Account added");
      await invalidateFinancialData(queryClient);
      onOpenChange(false);
    } catch (error) {
      setSubmitError(getErrorMessage(error, "Could not save this account."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{account ? "Edit account" : "Add account"}</DialogTitle>
          <DialogDescription>
            Track balances for bank accounts, cards, cash and investments.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          {submitError && (
            <div role="alert" className="rounded-lg border border-expense/30 bg-expense-light p-3 text-sm text-expense-text">
              {submitError}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="account-name">Name</Label>
            <Input
              id="account-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. HDFC Savings, Amex Gold"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "account-name-error" : undefined}
              autoFocus
            />
            {errors.name && <p id="account-name-error" className="text-xs text-expense-text">{errors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="account-type">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as AccountType)}>
                <SelectTrigger id="account-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-currency">Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as SupportedCurrency)}>
                <SelectTrigger id="account-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_LIST.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account-opening">{isLiability ? "Current balance owed" : "Opening balance"}</Label>
            <Input
              id="account-opening"
              type="number"
              inputMode="decimal"
              step="any"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              aria-invalid={Boolean(errors.openingBalance)}
              aria-describedby="account-opening-hint"
            />
            <p id="account-opening-hint" className="text-xs text-muted-foreground">
              {errors.openingBalance ? (
                <span className="text-expense-text">{errors.openingBalance}</span>
              ) : isLiability ? (
                "Enter debt as a negative number (e.g. -1200). Transactions added later adjust it."
              ) : (
                "The balance before the transactions you record in Spendly."
              )}
            </p>
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-main">Color</legend>
            <div className="flex flex-wrap gap-2">
              {ACCOUNT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  aria-pressed={color === c}
                  className={cn(
                    "h-7 w-7 rounded-full ring-offset-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    color === c && "ring-2 ring-main"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </fieldset>
          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : account ? "Save changes" : "Add account"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
