"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { NAV_GROUPS, ADMIN_BRAND } from "@/constants/nav";
import { cn } from "@/lib/utils";

export interface SidebarBadges {
  [key: string]: number | undefined;
}

interface SidebarProps {
  badges?: SidebarBadges;
}

export function Sidebar({ badges = {} }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-[244px] shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">{ADMIN_BRAND.title}</span>
          <span className="text-xs text-muted-foreground">{ADMIN_BRAND.subtitle}</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-0.5">
            <div className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {group.label}
            </div>
            {group.items.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(item.href + "/");
              const count = item.badgeKey ? badges[item.badgeKey] : undefined;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      active ? "text-sidebar-primary" : "text-muted-foreground group-hover:text-sidebar-primary"
                    )}
                  />
                  <span className="truncate flex-1">{item.label}</span>
                  {count !== undefined && count > 0 && (
                    <span
                      className={cn(
                        "inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200"
                      )}
                    >
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-4 py-3 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>v0.1 · 运营版</span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            服务正常
          </span>
        </div>
      </div>
    </aside>
  );
}
