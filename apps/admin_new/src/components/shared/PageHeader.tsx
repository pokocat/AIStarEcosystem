import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  tabs?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, tabs, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-5 md:mb-6", className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl md:text-[22px] font-semibold tracking-tight text-foreground">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
      {tabs && <div className="mt-4 border-b border-border">{tabs}</div>}
    </div>
  );
}
