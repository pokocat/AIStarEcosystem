"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { visibleNavGroups, ADMIN_BRAND } from "@/constants/nav";
import { useAdminIdentity } from "@/lib/useAdminRole";
import { cn } from "@/lib/utils";

export interface SidebarBadges {
  [key: string]: number | undefined;
}

interface SidebarProps {
  badges?: SidebarBadges;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ badges = {}, mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { role: currentRole, accountSource } = useAdminIdentity();
  const navGroups = React.useMemo(
    () => visibleNavGroups(currentRole, accountSource),
    [currentRole, accountSource]
  );

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/40 lg:hidden transition-opacity",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onMobileClose}
        aria-hidden
      />

      <aside
        className={cn(
          "flex w-[268px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar",
          // 窄屏下以抽屉形式出现
          "fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-out lg:static lg:translate-x-0 lg:z-auto",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
          <div
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-[13px] font-semibold tracking-tight text-primary ring-1 ring-inset ring-primary/20"
          >
            AS
          </div>
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">{ADMIN_BRAND.title}</span>
            <span className="text-xs text-muted-foreground">{ADMIN_BRAND.subtitle} · Admin</span>
          </div>
          <button
            type="button"
            aria-label="关闭菜单"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent/70 lg:hidden"
            onClick={onMobileClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              <div className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground">
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
                    aria-current={active ? "page" : undefined}
                    onClick={onMobileClose}
                    className={cn(
                      "group flex min-h-9 items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm"
                        : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
                        active ? "bg-primary/10 text-primary" : "text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                      )}
                    >
                      <Icon
                        className="h-4 w-4"
                        aria-hidden
                      />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {count !== undefined && count > 0 && (
                      <span
                        className={cn(
                          "inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20"
                        )}
                      >
                        {count}
                      </span>
                    )}
                    <span
                      aria-hidden
                      className={cn(
                        "h-1.5 w-1.5 rounded-full transition-colors",
                        active ? "bg-primary" : "bg-transparent"
                      )}
                    />
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border px-4 py-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Next 16 · 运营版</span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              已连接
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
