import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  delta?: { value: string; positive?: boolean };
  tone?: "default" | "warning" | "danger" | "success";
}

const toneRing: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "",
  warning: "ring-1 ring-inset ring-amber-100",
  danger: "ring-1 ring-inset ring-rose-100",
  success: "ring-1 ring-inset ring-emerald-100",
};

const toneIconBg: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "bg-indigo-50 text-indigo-600",
  warning: "bg-amber-50 text-amber-600",
  danger: "bg-rose-50 text-rose-600",
  success: "bg-emerald-50 text-emerald-600",
};

export function StatCard({ label, value, hint, icon: Icon, delta, tone = "default" }: StatCardProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-4 card-shadow sm:p-5", toneRing[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-[1.45rem] font-semibold leading-tight tabular-nums">{value}</span>
          {hint && <span className="text-xs text-muted-foreground truncate">{hint}</span>}
        </div>
        {Icon && (
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-md", toneIconBg[tone])}>
            <Icon className="h-4.5 w-4.5" />
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
