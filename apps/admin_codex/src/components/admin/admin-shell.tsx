"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bell, ChevronsUpDown, LogOut, Search, Sparkles } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/sidebar";
import { demoAdmin, ADMIN_SESSION_COOKIE } from "@/lib/session";
import { navGroups } from "@/lib/admin-data";

const routeMeta = [
  {
    prefix: "/admin/users",
    title: "用户账户",
    description: "筛选账号、核验状态并做行级预览。",
  },
  {
    prefix: "/admin/licenses",
    title: "卡密批次",
    description: "观察库存回收和渠道激活节奏。",
  },
  {
    prefix: "/admin/credits",
    title: "积分账本",
    description: "盯住悬挂预扣和人工调差动作。",
  },
  {
    prefix: "/admin/audit",
    title: "审计日志",
    description: "核查最近的高风险写操作。",
  },
  {
    prefix: "/admin/risk",
    title: "风控事件",
    description: "优先处理高风险异地登录和批量兑换。",
  },
  {
    prefix: "/admin",
    title: "概览看板",
    description: "保持对全平台运行状态的整体感知。",
  },
];

function isActivePath(pathname: string, href: string, exact?: boolean) {
  if (exact) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [clock, setClock] = useState("");

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour12: false,
    });

    const updateClock = () => setClock(formatter.format(new Date()));

    updateClock();
    const timer = window.setInterval(updateClock, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const currentMeta = useMemo(
    () => routeMeta.find((item) => pathname.startsWith(item.prefix)) ?? routeMeta[routeMeta.length - 1],
    [pathname]
  );

  function handleLogout() {
    document.cookie = `${ADMIN_SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
    router.push("/login");
    router.refresh();
  }

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon">
        <SidebarHeader className="gap-4 border-b border-sidebar-border px-3 py-4">
          <Link className="flex items-center gap-3 px-2" href="/admin">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground">
              <Sparkles className="size-4" />
            </div>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-semibold">AI Star Eco</p>
              <p className="truncate text-xs text-sidebar-foreground/70">Admin Codex Console</p>
            </div>
          </Link>
        </SidebarHeader>

        <SidebarContent className="px-2 py-4">
          {navGroups.map((group) => (
            <SidebarGroup key={group.title}>
              <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={isActivePath(pathname, item.href, item.exact)} tooltip={item.title}>
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter className="gap-3 border-t border-sidebar-border p-3">
          <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/80 p-3 group-data-[collapsible=icon]:hidden">
            <p className="text-xs uppercase tracking-[0.22em] text-sidebar-foreground/58">Current Access</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="secondary">{demoAdmin.role}</Badge>
              <p className="text-sm text-sidebar-foreground/80">内网访问 / 白名单模式</p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="justify-between" variant="secondary">
                <span className="truncate">{demoAdmin.name}</span>
                <ChevronsUpDown data-icon="inline-end" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link href="/admin/settings">系统设置</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleLogout}>
                  <LogOut />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="bg-transparent">
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-30 border-b border-white/60 bg-white/72 backdrop-blur-xl">
            <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
              <SidebarTrigger />
              <div className="hidden min-w-0 flex-1 items-center gap-4 md:flex">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{currentMeta.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{currentMeta.description}</p>
                </div>
                <div className="relative w-full max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" placeholder="搜索用户、租户、批次或审计动作" />
                </div>
                <Badge variant="outline">spec v1.3.0</Badge>
                <Badge variant="secondary">Live {clock || "--:--"}</Badge>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button aria-label="查看通知" className="animate-glow-pulse" size="icon" variant="outline">
                    <Bell data-icon="inline-start" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuGroup>
                    <DropdownMenuItem className="items-start">
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium">高风险异地登录待处理</p>
                        <p className="text-xs text-muted-foreground">Mika Nova 在 13:09 触发高风险事件。</p>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="items-start">
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium">批次库存率低于 30%</p>
                        <p className="text-xs text-muted-foreground">batch_PRO_20260416_A 进入回收观察区间。</p>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="items-start">
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium">发现失败写操作</p>
                        <p className="text-xs text-muted-foreground">license.revoke 需要 SUPER_ADMIN 进一步确认。</p>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <Avatar className="size-10">
                <AvatarFallback>LY</AvatarFallback>
              </Avatar>
            </div>
          </header>
          <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-[1520px] flex-col gap-6">{children}</div>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
