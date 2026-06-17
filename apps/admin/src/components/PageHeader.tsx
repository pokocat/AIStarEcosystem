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
    <div className={cn("mb-5 flex flex-col gap-3 border-b border-border/80 pb-4 sm:mb-6 sm:pb-5", className)}>
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="面包屑" className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          {breadcrumb.map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="opacity-45">/</span>}
              {b.href ? (
                <Link href={b.href} className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {b.label}
                </Link>
              ) : (
                <span>{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="text-[1.2rem] font-semibold leading-tight tracking-tight sm:text-[1.35rem]">{title}</h1>
          {description && (
            <p className="max-w-[72ch] text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="grid w-full grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:flex sm:w-auto sm:shrink-0 sm:flex-wrap sm:items-center sm:justify-end [&>*]:w-full sm:[&>*]:w-auto">
            {actions}
          </div>
        )}
      </div>

      {meta && <div className="-mb-1 min-w-0 overflow-x-auto">{meta}</div>}
    </div>
  );
}
