"use client";

import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Badge } from "@/components/ui/badge";

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">
      <div className="border-b border-sidebar-border px-6 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-sm font-bold text-white shadow-inner">
              AEP
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-sidebar-foreground/45">
                AI Star Eco
              </p>
              <p className="mt-1 text-base font-semibold text-sidebar-foreground">管理后台</p>
            </div>
          </div>
          <Badge variant="outline" className="border-white/15 bg-white/5 text-sidebar-foreground">
            beta
          </Badge>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        <SidebarNav />
      </nav>

      <div className="border-t border-sidebar-border px-4 py-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-xs font-medium text-sidebar-foreground/55">运行环境</p>
          <p className="mt-1 text-sm font-semibold text-sidebar-foreground">本地开发</p>
          <p className="mt-1 text-xs leading-5 text-sidebar-foreground/50">
            后端默认连接 `http://localhost:8080`
          </p>
        </div>
      </div>
    </aside>
  );
}
