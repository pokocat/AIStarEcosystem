import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  padding?: boolean;
}

export function Section({
  title, description, actions, children, className, bodyClassName, padding = true,
}: SectionProps) {
  return (
    <section className={cn("rounded-xl border border-border bg-card card-elev-1", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground truncate">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={cn(padding && "p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
