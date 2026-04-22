"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolbarProps {
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  children?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}

export function Toolbar({
  search, onSearchChange, searchPlaceholder = "搜索…", children, right, className,
}: ToolbarProps) {
  return (
    <div className={cn(
      "flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:gap-3",
      className
    )}>
      {onSearchChange !== undefined && (
        <div className="flex items-center h-9 w-full sm:w-72 rounded-md border border-border bg-input px-3 gap-2 text-sm">
          <Search className="h-4 w-4 text-muted-foreground/70" />
          <input
            type="search"
            value={search ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="bg-transparent outline-none flex-1 placeholder:text-muted-foreground/60"
          />
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">{children}</div>
      <div className="flex-1" />
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

interface FilterChipProps {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (v: string) => void;
}

export function FilterChip({ label, value, options, onChange }: FilterChipProps) {
  return (
    <label className="inline-flex items-center gap-1.5 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border border-border bg-input px-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
