"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SupportedCurrency } from "@/lib/currency/currencies";
import {
  TransactionForm,
  TransactionRecord,
} from "@/components/transactions/TransactionForm";

export interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Array<{ id: string; name: string; type: "income" | "expense" }>;
  defaultCurrency: SupportedCurrency;
  initialData: TransactionRecord;
  onSuccess: () => void;
}

export function TransactionDialog({
  open,
  onOpenChange,
  categories,
  defaultCurrency,
  initialData,
  onSuccess,
}: TransactionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Edit Transaction</DialogTitle>
        </DialogHeader>
        <TransactionForm
          categories={categories}
          defaultCurrency={defaultCurrency}
          initialData={initialData}
          onSuccess={() => {
            onSuccess();
            onOpenChange(false);
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
