"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BarChart3, ChevronRight, LayoutTemplate, LogOut, Radar, SlidersHorizontal, Sparkles } from "lucide-react";
import { Badge } from "@ai-star-eco/ui/ui/badge";
import { Button } from "@ai-star-eco/ui/ui/button";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider,
  SidebarRail, SidebarSeparator, SidebarTrigger, useSidebar,
} from "@ai-star-eco/ui/ui/sidebar";
import { AuthApi, type AdminIdentity } from "@/lib/api";
import { studioAdminPath } from "@/lib/app-path";

export type StudioModule = "business" | "technology" | "suppliers" | "scenes";

const MODULES = [
  { id: "business" as const, href: "/business", label: "经营分析", icon: BarChart3 },
  { id: "technology" as const, href: "/technology", label: "技术监控", icon: Radar },
  { id: "suppliers" as const, href: "/suppliers", label: "供应商分析", icon: SlidersHorizontal },
];

const MODULE_META: Record<StudioModule, { group: string; title: string; tabs: Array<{ id: string; label: string }> }> = {
  business: { group: "经营分析", title: "积分与经营", tabs: [{ id: "overview", label: "经营概览" }, { id: "spend", label: "消耗分析" }, { id: "issuance", label: "积分发放" }] },
  technology: { group: "技术监控", title: "生成与稳定性", tabs: [{ id: "models", label: "模型运行" }, { id: "quality", label: "失败与耗时" }, { id: "release", label: "发布与告警" }] },
  suppliers: { group: "供应商分析", title: "供应商性能", tabs: [{ id: "overview", label: "性能概览" }, { id: "details", label: "任务明细" }] },
  scenes: { group: "运营配置", title: "场景模板", tabs: [] },
};

function moduleHref(href: string, search: URLSearchParams) {
  const params = new URLSearchParams();
  const days = search.get("days");
  const demo = search.get("demo");
  if (days) params.set("days", days);
  if (demo === "1") params.set("demo", demo);
  return `${href}${params.size ? `?${params}` : ""}`;
}

function StudioNavigation({ module, identity, logout }: { module: StudioModule; identity: AdminIdentity | null; logout: () => void }) {
  const { setOpenMobile } = useSidebar();
  const search = useSearchParams();
  return (
    <Sidebar className="border-r bg-white" collapsible="offcanvas">
      <SidebarHeader className="gap-3 px-4 py-5">
        <Link href={moduleHref("/business", search)} onClick={() => setOpenMobile(false)} className="flex items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex size-10 items-center justify-center rounded-lg bg-[#4f6692] text-white shadow-sm"><Sparkles className="size-5" /></span>
          <span className="min-w-0"><span className="block text-[15px] font-bold tracking-tight text-slate-950">Studio Ops</span><span className="block text-xs text-slate-500">积分与生成运营台</span></span>
        </Link>
        {module !== "scenes" && <Badge variant="outline" className={`w-full justify-center py-1 ${search.get("demo") === "1" ? "border-[#d9d1de] bg-[#f1edf3] text-[#74667f]" : "border-slate-200 bg-slate-50 text-slate-600"}`}>{search.get("demo") === "1" ? "本地演示数据 · 只读" : "看板只读"}</Badge>}
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-[.12em] text-slate-400">数据中心</SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{MODULES.map((item) => {
            const active = module === item.id;
            return <SidebarMenuItem key={item.id}><SidebarMenuButton asChild isActive={active} tooltip={item.label} className="h-10 rounded-lg px-3 data-[active=true]:font-semibold"><Link href={moduleHref(item.href, search)} onClick={() => setOpenMobile(false)} aria-current={active ? "page" : undefined}><item.icon /><span>{item.label}</span><ChevronRight className="ml-auto size-3.5 opacity-35" /></Link></SidebarMenuButton></SidebarMenuItem>;
          })}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-[.12em] text-slate-400">运营配置</SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu><SidebarMenuItem><SidebarMenuButton asChild isActive={module === "scenes"} tooltip="场景模板" className="h-10 rounded-lg px-3 data-[active=true]:font-semibold"><Link href={moduleHref("/scenes", search)} onClick={() => setOpenMobile(false)} aria-current={module === "scenes" ? "page" : undefined}><LayoutTemplate /><span>场景模板</span><ChevronRight className="ml-auto size-3.5 opacity-35" /></Link></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3"><div className="rounded-xl border bg-slate-50 p-3"><div className="flex items-center gap-2"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">{(identity?.displayName || identity?.username || "管").slice(0, 1)}</span><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{identity?.displayName || "管理员"}</div><div className="truncate text-[11px] text-slate-500">{identity?.role || "权限校验中"}</div></div><Button variant="ghost" size="icon" className="size-8 text-slate-500" onClick={logout} aria-label="退出登录"><LogOut className="size-4" /></Button></div></div></SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

export function StudioShell({ children, module }: { children: React.ReactNode; module: StudioModule }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const meta = MODULE_META[module];
  const validTab = meta.tabs.some((item) => item.id === search.get("tab")) ? search.get("tab")! : meta.tabs[0]?.id;
  const [identity, setIdentity] = React.useState<AdminIdentity | null>(null);

  React.useEffect(() => {
    let active = true;
    void AuthApi.me().then((user) => { if (active) setIdentity(user); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const logout = () => { AuthApi.logout(); window.location.assign(studioAdminPath("/login")); };
  const tabHref = (tab: string) => {
    const params = new URLSearchParams(search.toString());
    params.set("tab", tab);
    return `${pathname}?${params}`;
  };

  return (
    <SidebarProvider defaultOpen>
      <StudioNavigation module={module} identity={identity} logout={logout} />
      <SidebarInset className="min-w-0 bg-[#f4f6fb]">
        <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
          <div className="flex min-h-14 items-center gap-3 px-4 md:px-5">
            <SidebarTrigger className="size-9 md:hidden" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] text-slate-400">Studio Ops / {meta.group}</p>
              <h1 className="truncate text-sm font-semibold text-slate-900">{meta.title}</h1>
            </div>
            {module !== "scenes" && <Badge variant="outline" className="hidden border-slate-200 bg-slate-50 text-slate-600 sm:flex">只读查询</Badge>}
          </div>
          {meta.tabs.length > 0 && (
            <nav aria-label={`${meta.group}子页面`} className="overflow-x-auto border-t px-4 md:px-5">
              <div className="flex min-w-max gap-5">{meta.tabs.map((item) => {
                const active = validTab === item.id;
                return (
                  <Link key={item.id} href={tabHref(item.id)} aria-current={active ? "page" : undefined}
                    className={`relative py-2.5 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-ring ${active ? "text-[#4f6692]" : "text-slate-500 hover:text-slate-900"}`}>
                    {item.label}{active && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#4f6692]" />}
                  </Link>
                );
              })}</div>
            </nav>
          )}
        </header>
        <main id="studio-main" className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
