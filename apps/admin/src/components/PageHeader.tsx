import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumb?: { label: string; href?: string }[];
  actions?: ReactNode;
  /** Render below the title row (e.g. tabs, filters). Spans full width. */
  meta?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3 border-b border-border pb-4 mb-6", className)}>
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="面包屑" className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {breadcrumb.map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="opacity-50">/</span>}
              {b.href ? (
                <Link href={b.href} className="rounded-sm hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {b.label}
                </Link>
              ) : (
                <span>{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="text-xl font-semibold tracking-tight leading-tight">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[70ch]">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
            {actions}
          </div>
        )}
      </div>

      {meta && <div className="-mb-1">{meta}</div>}
    </div>
  );
}
