"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Activity,
  BarChart3,
  BellRing,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  LayoutTemplate,
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
  useSidebar,
} from "@ai-star-eco/ui/ui/sidebar";
import { AuthApi, type AdminIdentity } from "@/lib/api";
import { studioAdminPath } from "@/lib/app-path";

type View = "business" | "technology";
/** dashboard = 经营 / 技术两个只读看板；scenes = 运营配置里的「场景模板」（可编辑）。 */
export type StudioPage = "dashboard" | "scenes";

function dashboardHref(view: View, days: 1 | 7 | 30, hash = "") {
  return `/?view=${view}&days=${days}${hash}`;
}

function StudioNavigation({
  page,
  view,
  days,
  hash,
  identity,
  logout,
}: {
  page: StudioPage;
  view: View;
  days: 1 | 7 | 30;
  hash: string;
  identity: AdminIdentity | null;
  logout: () => void;
}) {
  const { setOpenMobile } = useSidebar();
  const items = page === "scenes"
    ? [
        { href: dashboardHref("business", days), label: "经营看板", icon: BarChart3, hash: "never" },
        { href: dashboardHref("technology", days), label: "技术看板", icon: Radar, hash: "never" },
      ]
    : view === "business"
    ? [
        { href: dashboardHref(view, days), label: "经营概览", icon: BarChart3, hash: "" },
        { href: dashboardHref(view, days, "#health"), label: "健康状态", icon: ClipboardCheck, hash: "#health" },
        { href: dashboardHref(view, days, "#spend"), label: "积分消耗", icon: Activity, hash: "#spend" },
        { href: dashboardHref(view, days, "#issuance"), label: "积分发放", icon: CircleDollarSign, hash: "#issuance" },
      ]
    : [
        { href: dashboardHref(view, days), label: "技术概览", icon: Radar, hash: "" },
        { href: dashboardHref(view, days, "#health"), label: "健康状态", icon: ClipboardCheck, hash: "#health" },
        { href: dashboardHref(view, days, "#models"), label: "生成任务", icon: Activity, hash: "#models" },
        { href: dashboardHref(view, days, "#failure-analysis"), label: "失败与耗时", icon: BarChart3, hash: "#failure-analysis" },
        { href: dashboardHref(view, days, "#release-alerts"), label: "发布与告警", icon: BellRing, hash: "#release-alerts" },
      ];

  return (
    <Sidebar className="border-r bg-white" collapsible="offcanvas">
      <SidebarHeader className="gap-3 px-4 py-5">
        <Link href={dashboardHref(view, days)} onClick={() => setOpenMobile(false)} className="flex items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex size-10 items-center justify-center rounded-lg bg-[#4f6692] text-white shadow-sm">
            <Sparkles className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-bold tracking-tight text-slate-950">Studio Ops</span>
            <span className="block text-xs text-slate-500">积分与生成运营台</span>
          </span>
        </Link>
        {page === "dashboard" && <Badge variant="outline" className="w-full justify-center border-slate-200 bg-slate-50 py-1 text-slate-600">
          <ShieldCheck className="size-3.5" /> 看板只读
        </Badge>}
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-[.12em] text-slate-400">
            {page === "scenes" ? "看板" : "本页导航"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = page === "dashboard" && (item.hash ? hash === item.hash : !hash);
                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label} className="h-10 rounded-lg px-3 data-[active=true]:font-semibold">
                      <Link href={item.href} onClick={() => setOpenMobile(false)} aria-current={active ? "location" : undefined}>
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
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-[.12em] text-slate-400">
            运营配置
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={page === "scenes"} tooltip="场景模板" className="h-10 rounded-lg px-3 data-[active=true]:font-semibold">
                  <Link href="/scenes" onClick={() => setOpenMobile(false)} aria-current={page === "scenes" ? "page" : undefined}>
                    <LayoutTemplate />
                    <span>场景模板</span>
                    <ChevronRight className="ml-auto size-3.5 opacity-35" />
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
  );
}

export function StudioShell({ children, page = "dashboard" }: { children: React.ReactNode; page?: StudioPage }) {
  const search = useSearchParams();
  const view: View = search.get("view") === "technology" ? "technology" : "business";
  const days = search.get("days") === "1" ? 1 : search.get("days") === "30" ? 30 : 7;
  const [identity, setIdentity] = React.useState<AdminIdentity | null>(null);
  const [hash, setHash] = React.useState("");

  React.useEffect(() => {
    let active = true;
    void AuthApi.me().then((user) => { if (active) setIdentity(user); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  React.useEffect(() => {
    const update = () => setHash(window.location.hash);
    update();
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
    };
  }, []);

  const logout = () => {
    AuthApi.logout();
    window.location.assign(studioAdminPath("/login"));
  };

  const viewHref = (next: View) => {
    const params = new URLSearchParams(search.toString());
    params.set("view", next);
    params.set("days", String(days));
    return `/?${params.toString()}`;
  };

  return (
    <SidebarProvider defaultOpen>
      <StudioNavigation page={page} view={view} days={days} hash={hash} identity={identity} logout={logout} />
      <SidebarInset className="min-w-0 bg-[#f4f6fb]">
        <header className="sticky top-0 z-30 flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 border-b bg-white/95 px-4 py-2 backdrop-blur md:px-6">
          <SidebarTrigger className="size-9 md:hidden" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] text-slate-400">{page === "scenes" ? "Studio Ops / 运营配置" : "Studio Ops / 积分与生成看板"}</p>
            <h1 className="truncate text-sm font-semibold text-slate-900">{page === "scenes" ? "场景模板" : view === "technology" ? "技术看板" : "经营看板"}</h1>
          </div>
          {page === "dashboard" && <><nav role="tablist" aria-label="看板页签" className="order-3 grid h-9 w-full grid-cols-2 rounded-xl bg-slate-100 p-[3px] text-sm sm:order-none sm:w-[220px]">
            <Link role="tab" aria-selected={view === "business"} aria-current={view === "business" ? "page" : undefined} href={viewHref("business")} onClick={() => setHash("")}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 font-medium text-slate-600 outline-none transition hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-ring aria-selected:bg-white aria-selected:text-slate-950 aria-selected:shadow-sm">
              <BarChart3 className="size-4" />经营
            </Link>
            <Link role="tab" aria-selected={view === "technology"} aria-current={view === "technology" ? "page" : undefined} href={viewHref("technology")} onClick={() => setHash("")}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 font-medium text-slate-600 outline-none transition hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-ring aria-selected:bg-white aria-selected:text-slate-950 aria-selected:shadow-sm">
              <Radar className="size-4" />技术
            </Link>
          </nav>
          <Badge variant="outline" className="hidden border-slate-200 bg-slate-50 text-slate-600 sm:flex">
            <ShieldCheck className="size-3.5" /> 只读查询
          </Badge></>}
        </header>
        <main id="studio-main" className="min-w-0 flex-1 overflow-x-hidden">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
