"use client";

import { memo, useMemo, useRef } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type OnChangeFn,
  type RowSelectionState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { format } from "date-fns";
import { ArrowDown, ArrowUp, ArrowUpDown, Edit2, Eye, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import { IconRenderer } from "@/components/shared/IconRenderer";
import { formatCurrency } from "@/lib/currency/currencies";
import { cn } from "@/lib/utils";
import type { TransactionRow } from "./types";
import type { SortBy } from "./useTransactionsUrlState";

/** Rows beyond this count are virtualized (only visible rows are in the DOM). */
const VIRTUALIZE_AFTER = 60;
const ROW_HEIGHT = 52;

export const COLUMN_LABELS: Record<string, string> = {
  title: "Transaction",
  category: "Category",
  account: "Account",
  date: "Date",
  paymentMethod: "Method",
  amount: "Amount",
};

interface Props {
  rows: TransactionRow[];
  sortBy: SortBy;
  sortOrder: "asc" | "desc";
  onSort: (column: SortBy) => void;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
  columnVisibility: VisibilityState;
  columnSizing: ColumnSizingState;
  onColumnSizingChange: OnChangeFn<ColumnSizingState>;
  onView: (row: TransactionRow) => void;
  onEdit: (row: TransactionRow) => void;
  onDelete: (row: TransactionRow) => void;
}

function SortHeader({
  label,
  column,
  sortBy,
  sortOrder,
  onSort,
  align = "left",
}: {
  label: string;
  column: SortBy;
  sortBy: SortBy;
  sortOrder: "asc" | "desc";
  onSort: (c: SortBy) => void;
  align?: "left" | "right";
}) {
  const active = sortBy === column;
  const Icon = !active ? ArrowUpDown : sortOrder === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={cn(
        "inline-flex items-center gap-1 rounded px-1 -mx-1 font-medium hover:text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        active && "text-main",
        align === "right" && "flex-row-reverse"
      )}
      aria-label={`Sort by ${label}${active ? (sortOrder === "asc" ? ", ascending" : ", descending") : ""}`}
    >
      {label}
      <Icon className={cn("h-3 w-3", !active && "opacity-40")} />
    </button>
  );
}

function TransactionsTableImpl({
  rows,
  sortBy,
  sortOrder,
  onSort,
  rowSelection,
  onRowSelectionChange,
  columnVisibility,
  columnSizing,
  onColumnSizingChange,
  onView,
  onEdit,
  onDelete,
}: Props) {
  const columns = useMemo<ColumnDef<TransactionRow>[]>(
    () => [
      {
        id: "select",
        size: 44,
        enableResizing: false,
        enableHiding: false,
        header: ({ table }) => (
          <input
            type="checkbox"
            aria-label="Select all on this page"
            className="h-4 w-4 cursor-pointer rounded border-border-strong accent-primary"
            checked={table.getIsAllPageRowsSelected()}
            ref={(el) => {
              if (el) el.indeterminate = table.getIsSomePageRowsSelected();
            }}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`Select ${row.original.title}`}
            className="h-4 w-4 cursor-pointer rounded border-border-strong accent-primary"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
      },
      {
        id: "title",
        size: 280,
        minSize: 160,
        enableHiding: false,
        header: () => <SortHeader label="Transaction" column="title" {...{ sortBy, sortOrder, onSort }} />,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-main">{row.original.title}</p>
            {row.original.notes && (
              <p className="truncate text-[11px] text-muted-foreground">{row.original.notes}</p>
            )}
          </div>
        ),
      },
      {
        id: "category",
        size: 170,
        minSize: 110,
        header: "Category",
        cell: ({ row }) => {
          const c = row.original.category;
          return (
            <Badge
              variant="secondary"
              className="max-w-full gap-1 truncate font-normal text-main"
              style={{ backgroundColor: `${c.color || "#2878E5"}18` }}
            >
              {/* Category color on the icon only: user-chosen colors can't guarantee text contrast */}
              <span style={{ color: c.color || "#2878E5" }} className="inline-flex shrink-0">
                <IconRenderer name={c.icon || "Tag"} className="h-3 w-3" />
              </span>
              <span className="truncate">{c.name}</span>
            </Badge>
          );
        },
      },
      {
        id: "account",
        size: 150,
        minSize: 100,
        header: "Account",
        cell: ({ row }) =>
          row.original.account ? (
            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.original.account.color }} />
              <span className="truncate">{row.original.account.name}</span>
            </span>
          ) : (
            <span className="text-muted-subtle">—</span>
          ),
      },
      {
        id: "date",
        size: 120,
        minSize: 100,
        header: () => <SortHeader label="Date" column="date" {...{ sortBy, sortOrder, onSort }} />,
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {format(new Date(row.original.date), "dd MMM yyyy")}
          </span>
        ),
      },
      {
        id: "paymentMethod",
        size: 120,
        minSize: 90,
        header: "Method",
        cell: ({ row }) => <span className="truncate text-muted-foreground">{row.original.paymentMethod}</span>,
      },
      {
        id: "amount",
        size: 140,
        minSize: 110,
        enableHiding: false,
        header: () => (
          <div className="text-right">
            <SortHeader label="Amount" column="amount" align="right" {...{ sortBy, sortOrder, onSort }} />
          </div>
        ),
        cell: ({ row }) => {
          const income = row.original.type === "income";
          return (
            <div className={cn("text-right font-semibold tabular-nums", income ? "text-income-text" : "text-expense-text")}>
              {income ? "+" : "−"}
              {formatCurrency(row.original.amount, row.original.currency)}
            </div>
          );
        },
      },
      {
        id: "actions",
        size: 112,
        enableResizing: false,
        enableHiding: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-0.5">
            <Hint label="Details">
              <Button variant="ghost" size="icon-sm" onClick={() => onView(row.original)} aria-label={`View ${row.original.title}`}>
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </Hint>
            <Hint label="Edit">
              <Button variant="ghost" size="icon-sm" onClick={() => onEdit(row.original)} aria-label={`Edit ${row.original.title}`}>
                <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </Hint>
            <Hint label="Delete">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onDelete(row.original)}
                aria-label={`Delete ${row.original.title}`}
                className="hover:bg-expense-light"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </Hint>
          </div>
        ),
      },
    ],
    [sortBy, sortOrder, onSort, onView, onEdit, onDelete]
  );

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    enableRowSelection: true,
    columnResizeMode: "onChange",
    state: { rowSelection, columnVisibility, columnSizing },
    onRowSelectionChange,
    onColumnSizingChange,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const tableRows = table.getRowModel().rows;
  const virtualize = tableRows.length > VIRTUALIZE_AFTER;
  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    enabled: virtualize,
  });
  const virtualItems = virtualize ? virtualizer.getVirtualItems() : [];
  const paddingTop = virtualize && virtualItems.length ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualize && virtualItems.length ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end : 0;
  const visibleRows = virtualize ? virtualItems.map((v) => tableRows[v.index]) : tableRows;
  const colCount = table.getVisibleLeafColumns().length;

  return (
    <div
      ref={scrollRef}
      className={cn("overflow-auto", virtualize ? "max-h-[70vh]" : "max-h-[calc(100vh-18rem)] min-h-0")}
    >
      <table className="w-full table-fixed text-left text-xs" style={{ minWidth: table.getTotalSize() }}>
        <thead className="sticky top-0 z-10 bg-[#F7F9FD] shadow-[inset_0_-1px_0_theme(colors.border.DEFAULT)]">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th
                  key={header.id}
                  scope="col"
                  style={{ width: header.getSize() }}
                  className="relative px-3 py-2.5 font-medium text-muted-foreground first:pl-4"
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getCanResize() && (
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      onDoubleClick={() => header.column.resetSize()}
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize ${COLUMN_LABELS[header.column.id] ?? header.column.id} column`}
                      className={cn(
                        "absolute right-0 top-1/2 h-5 w-1.5 -translate-y-1/2 cursor-col-resize touch-none select-none rounded-full",
                        header.column.getIsResizing() ? "bg-primary" : "hover:bg-border-strong"
                      )}
                    />
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {paddingTop > 0 && (
            <tr aria-hidden="true">
              <td colSpan={colCount} style={{ height: paddingTop }} />
            </tr>
          )}
          {visibleRows.map((row) => (
            <tr
              key={row.id}
              data-state={row.getIsSelected() ? "selected" : undefined}
              className="border-b border-border transition-colors last:border-0 hover:bg-muted/60 data-[state=selected]:bg-primary-light/60"
              style={{ height: ROW_HEIGHT }}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="overflow-hidden px-3 py-2 first:pl-4">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {paddingBottom > 0 && (
            <tr aria-hidden="true">
              <td colSpan={colCount} style={{ height: paddingBottom }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export const TransactionsTable = memo(TransactionsTableImpl);
