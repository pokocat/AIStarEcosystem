"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { NAV_GROUPS, ADMIN_BRAND } from "@/constants/nav";
import type { SidebarBadges } from "@/lib/useSidebarBadges";
import { cn } from "@/lib/utils";

interface SidebarProps {
  badges?: SidebarBadges;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({
  badges = {},
  collapsed = false,
  onToggleCollapsed,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/45 backdrop-blur-sm lg:hidden transition-opacity",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onMobileClose}
        aria-hidden
      />

      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar",
          "fixed inset-y-0 left-0 z-50 transform transition-all duration-200 ease-out lg:static lg:translate-x-0 lg:z-auto",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          collapsed ? "w-[64px]" : "w-[252px]"
        )}
      >
        {/* Brand */}
        <div className={cn(
          "flex items-center gap-2.5 border-b border-sidebar-border px-4 py-4",
          collapsed && "justify-center px-2"
        )}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--violet)] text-white shadow-sm">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight flex-1 min-w-0">
              <span className="text-sm font-semibold truncate">{ADMIN_BRAND.title}</span>
              <span className="text-[11px] text-muted-foreground truncate">{ADMIN_BRAND.subtitle}</span>
            </div>
          )}
          <button
            type="button"
            aria-label="关闭菜单"
            className="lg:hidden inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent/60"
            onClick={onMobileClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className={cn(
          "flex-1 overflow-y-auto py-3 space-y-5",
          collapsed ? "px-2" : "px-3"
        )}>
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="space-y-0.5">
              {!collapsed && (
                <div className="px-2 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
                  {group.label}
                </div>
              )}
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
                    onClick={onMobileClose}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-lg text-sm transition-all",
                      collapsed ? "justify-center px-0 py-2" : "px-2.5 py-1.5",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                    )}
                  >
                    {active && !collapsed && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-sidebar-primary" />
                    )}
                    <Icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0",
                        active ? "text-sidebar-primary" : "text-muted-foreground/70 group-hover:text-sidebar-primary"
                      )}
                    />
                    {!collapsed && <span className="truncate flex-1">{item.label}</span>}
                    {!collapsed && count !== undefined && count > 0 && (
                      <span
                        className={cn(
                          "inline-flex h-4.5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-destructive-soft text-destructive ring-1 ring-inset ring-destructive/20"
                        )}
                      >
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                    {collapsed && count !== undefined && count > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 inline-flex h-2 w-2 rounded-full bg-destructive ring-2 ring-sidebar" />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className={cn(
          "flex items-center border-t border-sidebar-border px-4 py-3 text-xs text-muted-foreground",
          collapsed && "justify-center px-2"
        )}>
          {!collapsed && (
            <div className="flex items-center gap-1.5 flex-1">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
              <span>服务正常</span>
              <span className="text-muted-foreground/60">·</span>
              <span>v2.0</span>
            </div>
          )}
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="hidden lg:inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
            aria-label={collapsed ? "展开侧栏" : "折叠侧栏"}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>
    </>
  );
}
