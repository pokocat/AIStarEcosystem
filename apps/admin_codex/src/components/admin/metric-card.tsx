import type { CSSProperties } from "react";

import { ArrowUpRight } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  title,
  value,
  delta,
  description,
  className,
  style,
}: {
  title: string;
  value: string;
  delta: string;
  description: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Card
      className={cn(
        "border-white/70 bg-white/80 shadow-[0_14px_34px_rgba(15,23,42,0.05)] backdrop-blur transition-transform duration-300 hover:-translate-y-0.5",
        className
      )}
      style={style}
    >
      <CardHeader className="gap-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="flex items-center justify-between text-3xl tabular-nums">
          {value}
          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2 py-1 text-xs font-medium text-cyan-900">
            <ArrowUpRight className="size-3.5" />
            {delta}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
