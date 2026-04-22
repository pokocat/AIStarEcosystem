import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "primary" | "emerald" | "amber" | "violet" | "sky" | "rose";

const TONE_STYLES: Record<Tone, { bg: string; fg: string; ring: string }> = {
  primary: { bg: "bg-primary-soft",     fg: "text-primary",   ring: "ring-primary/15" },
  emerald: { bg: "bg-success-soft",     fg: "text-success",   ring: "ring-success/15" },
  amber:   { bg: "bg-warning-soft",     fg: "text-amber-600", ring: "ring-warning/20" },
  violet:  { bg: "bg-violet-soft",      fg: "text-violet",    ring: "ring-violet/15" },
  sky:     { bg: "bg-info-soft",        fg: "text-info",      ring: "ring-info/15" },
  rose:    { bg: "bg-destructive-soft", fg: "text-destructive", ring: "ring-destructive/15" },
};

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  delta?: number;           // 正数=涨绿，负数=跌红；以"%"显示
  deltaUnit?: "%" | "";
  icon?: LucideIcon;
  tone?: Tone;
  className?: string;
}

export function StatCard({
  label, value, hint, delta, deltaUnit = "%", icon: Icon, tone = "primary", className,
}: StatCardProps) {
  const t = TONE_STYLES[tone];
  return (
    <div className={cn(
      "rounded-xl border border-border bg-card card-elev-1 p-4 flex items-start gap-3 transition-shadow hover:card-elev-2",
      className
    )}>
      {Icon && (
        <div className={cn(
          "shrink-0 h-10 w-10 rounded-xl flex items-center justify-center ring-1 ring-inset",
          t.bg, t.fg, t.ring
        )}>
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <div className="text-[22px] font-semibold tabular-nums leading-7 text-foreground">{value}</div>
          {delta !== undefined && (
            <span className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
              delta >= 0 ? "text-success" : "text-destructive"
            )}>
              {delta >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {Math.abs(delta)}{deltaUnit}
            </span>
          )}
        </div>
        {hint && <div className="mt-1 text-[11.5px] text-muted-foreground truncate">{hint}</div>}
      </div>
    </div>
  );
}
