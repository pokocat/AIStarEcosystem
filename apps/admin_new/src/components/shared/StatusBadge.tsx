import { cn } from "@/lib/utils";

export type StatusTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "violet";

const TONES: Record<StatusTone, string> = {
  success: "bg-success-soft text-success ring-success/20",
  warning: "bg-warning-soft text-amber-700 ring-warning/25",
  danger: "bg-destructive-soft text-destructive ring-destructive/20",
  info: "bg-info-soft text-info ring-info/20",
  neutral: "bg-muted text-muted-foreground ring-border",
  violet: "bg-violet-soft text-violet ring-violet/20",
};

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
  dot?: boolean;
  className?: string;
}

export function StatusBadge({ label, tone = "neutral", dot = true, className }: StatusBadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-medium ring-1 ring-inset",
      TONES[tone],
      className
    )}>
      {dot && <span className="dot" />}
      {label}
    </span>
  );
}
