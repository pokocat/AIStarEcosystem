"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EmptyState } from "./EmptyState";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
  headClassName?: string;
  align?: "left" | "right" | "center";
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDesc?: string;
  className?: string;
  stickyHeader?: boolean;
}

export function DataTable<T>({
  columns, rows, rowKey, onRowClick,
  emptyTitle = "暂无数据", emptyDesc, className, stickyHeader = true,
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className={cn("rounded-xl border border-border bg-card", className)}>
        <EmptyState title={emptyTitle} description={emptyDesc} />
      </div>
    );
  }
  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular">
          <thead className={cn(
            "bg-surface-muted text-muted-foreground",
            stickyHeader && "sticky top-0 z-10"
          )}>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={c.width ? { width: c.width } : undefined}
                  className={cn(
                    "px-4 py-2.5 text-[11.5px] font-medium uppercase tracking-wider whitespace-nowrap border-b border-border text-left",
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                    c.headClassName
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-border/70 last:border-b-0 transition-colors",
                  onRowClick && "cursor-pointer hover:bg-surface-muted/60",
                  i % 2 === 1 && "bg-surface-muted/25"
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-4 py-2.5 text-[13px] text-foreground",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                      c.className
                    )}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
