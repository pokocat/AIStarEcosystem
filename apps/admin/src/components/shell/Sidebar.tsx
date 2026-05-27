"use client";

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

  return (
    <>
      {/* 遮罩层（仅窄屏显示） */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden transition-opacity",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onMobileClose}
        aria-hidden
      />

      <aside
        className={cn(
          "flex w-[244px] shrink-0 flex-col border-r border-border bg-sidebar",
          // 窄屏下以抽屉形式出现
          "fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-out lg:static lg:translate-x-0 lg:z-auto",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
          <div
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold text-[13px] tracking-tight"
          >
            AS
          </div>
          <div className="flex flex-col leading-tight flex-1 min-w-0">
            <span className="text-sm font-semibold tracking-tight">{ADMIN_BRAND.title}</span>
            <span className="text-xs text-muted-foreground">{ADMIN_BRAND.subtitle}</span>
          </div>
          <button
            type="button"
            aria-label="关闭菜单"
            className="lg:hidden inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent/60"
            onClick={onMobileClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
          {visibleNavGroups(currentRole, accountSource).map((group) => (
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
                    onClick={onMobileClose}
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
                            : "bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20"
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
    </>
  );
}
