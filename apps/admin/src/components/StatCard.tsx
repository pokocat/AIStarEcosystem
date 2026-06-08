import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: LucideIcon;
  delta?: { value: string; positive?: boolean };
  tone?: "default" | "warning" | "danger" | "success";
}

const toneRing: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "",
  warning: "ring-1 ring-inset ring-warning/20",
  danger: "ring-1 ring-inset ring-destructive/20",
  success: "ring-1 ring-inset ring-success/20",
};

const toneIconBg: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "bg-primary/10 text-primary",
  warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/10 text-destructive",
  success: "bg-success/10 text-success",
};

export function StatCard({ label, value, hint, icon: Icon, delta, tone = "default" }: StatCardProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-4 card-shadow sm:p-5", toneRing[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
          <span className="text-[1.42rem] font-semibold leading-tight tracking-tight tabular-nums">{value}</span>
          {hint && <span className="truncate text-xs leading-5 text-muted-foreground">{hint}</span>}
        </div>
        {Icon && (
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-md", toneIconBg[tone])}>
            <Icon className="h-[18px] w-[18px]" />
          </div>
        )}
      </div>
      {delta && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          {delta.positive ? (
            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5 text-rose-600" />
          )}
          <span className={delta.positive ? "text-emerald-600" : "text-rose-600"}>{delta.value}</span>
          <span className="text-muted-foreground">较上月</span>
        </div>
      )}
    </div>
  );
}
