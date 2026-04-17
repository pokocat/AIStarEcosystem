import type { StatusMeta } from "@/constants/status";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  meta: StatusMeta | undefined;
  fallback?: string;
  className?: string;
  dot?: boolean;
}

export function StatusBadge({ meta, fallback = "—", className, dot }: StatusBadgeProps) {
  if (!meta) return <span className="text-muted-foreground">{fallback}</span>;
  return (
    <Badge tone={meta.tone} className={cn(className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {meta.label}
    </Badge>
  );
}
