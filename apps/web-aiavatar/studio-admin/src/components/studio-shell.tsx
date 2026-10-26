"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Activity,
  BarChart3,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  LogOut,
  Radar,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@ai-star-eco/ui/ui/badge";
import { Button } from "@ai-star-eco/ui/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@ai-star-eco/ui/ui/sidebar";
import { AuthApi, type AdminIdentity } from "@/lib/api";
import { studioAdminPath } from "@/lib/app-path";

const NAV = [
  {
    label: "运营视图",
    items: [
      { href: "/?view=business&days=7", label: "经营总览", icon: BarChart3, view: "business" },
      { href: "/?view=technology&days=7", label: "技术监控", icon: Radar, view: "technology" },
    ],
  },
  {
    label: "只读数据",
    items: [
      { href: "/?view=business&days=7#health", label: "对账健康", icon: ClipboardCheck, view: "health" },
      { href: "/?view=business&days=7#issuance", label: "积分发放", icon: CircleDollarSign, view: "issuance" },
      { href: "/?view=technology&days=7#models", label: "生成任务", icon: Activity, view: "models" },
    ],
  },
] as const;

export function StudioShell({ children }: { children: React.ReactNode }) {
  const search = useSearchParams();
  const view = search.get("view") === "technology" ? "technology" : "business";
  const [identity, setIdentity] = React.useState<AdminIdentity | null>(null);

  React.useEffect(() => {
    let active = true;
    void AuthApi.me().then((user) => { if (active) setIdentity(user); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const logout = () => {
    AuthApi.logout();
    window.location.assign(studioAdminPath("/login"));
  };

  return (
    <SidebarProvider defaultOpen>
      <Sidebar className="border-r bg-white" collapsible="offcanvas">
        <SidebarHeader className="gap-3 px-4 py-5">
          <Link href="/" className="flex items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex size-10 items-center justify-center rounded-lg bg-[#4f6692] text-white shadow-sm">
              <Sparkles className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-bold tracking-tight text-slate-950">Studio Ops</span>
              <span className="block text-xs text-slate-500">积分与生成运营台</span>
            </span>
          </Link>
          <Badge variant="outline" className="w-full justify-center border-slate-200 bg-slate-50 py-1 text-slate-600">
            <ShieldCheck className="size-3.5" /> 只读模式
          </Badge>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent className="px-2 py-3">
          {NAV.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-[.12em] text-slate-400">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const active = item.view === view || (item.view === "health" && view === "business" && typeof window !== "undefined" && window.location.hash === "#health")
                      || (item.view === "issuance" && typeof window !== "undefined" && window.location.hash === "#issuance")
                      || (item.view === "models" && typeof window !== "undefined" && window.location.hash === "#models");
                    return (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton asChild isActive={active} tooltip={item.label} className="h-10 rounded-lg px-3 data-[active=true]:font-semibold">
                          <Link href={item.href}>
                            <item.icon />
                            <span>{item.label}</span>
                            <ChevronRight className="ml-auto size-3.5 opacity-35" />
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter className="p-3">
          <div className="rounded-xl border bg-slate-50 p-3">
            <div className="flex items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                {(identity?.displayName || identity?.username || "管").slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{identity?.displayName || "管理员"}</div>
                <div className="truncate text-[11px] text-slate-500">{identity?.role || "权限校验中"}</div>
              </div>
              <Button variant="ghost" size="icon" className="size-8 text-slate-500" onClick={logout} aria-label="退出登录">
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-w-0 bg-[#f4f6fb]">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-white/90 px-4 backdrop-blur md:h-16 md:px-6">
          <SidebarTrigger className="size-9 md:hidden" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-slate-400">Studio / 运营后台</p>
            <h1 className="truncate text-sm font-semibold text-slate-900">{view === "technology" ? "技术监控" : "经营总览"}</h1>
          </div>
          <Badge variant="outline" className="hidden border-emerald-200 bg-emerald-50 text-emerald-700 sm:flex">
            <span className="size-1.5 rounded-full bg-emerald-500" /> 服务端权限校验
          </Badge>
        </header>
        <main id="studio-main" className="min-w-0 flex-1 overflow-x-hidden">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
