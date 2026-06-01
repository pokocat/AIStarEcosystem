"use client";

// AiAvatar 资产中心 · 工作台外壳（route group `(workspace)` 不出现在 URL）。
// IA 主线：资产库（家）→ 打开一个 AiAvatar → 沿其 7 步链路推进 → 衍生 → 归档。
// 导航分两层：① 主线（资产库 + 新建 CTA）；② 工具（任务 / 模板 / 授权 / 能力），视觉降一级。
// 精调工作台不在导航里——它是某个 AiAvatar 当前阶段的动作，从详情页进入。

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity, Boxes, ChevronRight, LayoutGrid, ListChecks, LogOut,
  Plus, ShieldCheck, Sparkles, Wrench,
} from "lucide-react";
import { useAuth } from "@ai-star-eco/api-client";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { ConfirmProvider } from "@/components/common/confirm-dialog";
import { useJobList } from "@/lib/use-job-poll";

interface NavItem { label: string; href: string; icon: React.ComponentType<{ className?: string }>; }

const PRIMARY: NavItem[] = [
  { label: "资产库", href: "/library", icon: LayoutGrid },
];

const TOOLS: NavItem[] = [
  { label: "任务中心", href: "/jobs", icon: ListChecks },
  { label: "模板库", href: "/templates", icon: Sparkles },
  { label: "授权总览", href: "/licenses", icon: ShieldCheck },
  { label: "能力状态", href: "/health", icon: Activity },
];

const CRUMB: Record<string, string> = {
  library: "资产库", create: "新建 AiAvatar", avatar: "资产详情", templates: "模板库",
  refine: "精调工作台", licenses: "授权总览", jobs: "任务中心", health: "能力状态",
};

function isActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/library" && pathname.startsWith(href));
}

function NavRow({ item, active, badge }: { item: NavItem; active: boolean; badge?: number }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
        active
          ? "bg-[var(--brand-soft)] font-medium text-[var(--brand-strong)]"
          : "text-[var(--fg-2)] hover:bg-[var(--bg-2)] hover:text-[var(--fg-0)]",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {badge != null && badge > 0 && (
        <span className="num inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-bold text-[var(--brand-ink)]">
          {badge}
        </span>
      )}
    </Link>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { jobs } = useJobList(3000);
  const activeJobs = jobs.filter((j) => j.status === "running" || j.status === "queued").length;

  const seg = pathname.split("/").filter(Boolean)[0] ?? "library";
  const crumb = CRUMB[seg] ?? "资产库";

  return (
    <div className="flex min-h-screen bg-[var(--bg-0)] text-[var(--fg-0)]">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-[var(--line)] bg-[var(--panel)] md:flex">
        <Link href="/library" className="flex items-center gap-2.5 px-5 pb-4 pt-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand)] text-[var(--brand-ink)] shadow-[var(--shadow-sm)]">
            <Boxes className="h-4.5 w-4.5" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight text-[var(--fg-0)]">AiAvatar 资产中心</div>
            <div className="num text-[10px] text-[var(--fg-3)]">ASSET HUB</div>
          </div>
        </Link>

        {/* 主操作：新建（开启一条新的生产主线）*/}
        <div className="px-3 pb-3">
          <Link href="/create" className="btn btn-primary w-full">
            <Plus className="h-4 w-4" /> 新建 AiAvatar
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {PRIMARY.map((it) => (
            <NavRow key={it.href} item={it} active={isActive(pathname, it.href)} />
          ))}

          <div className="px-2.5 pb-1 pt-5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--fg-3)]">
            工具
          </div>
          {TOOLS.map((it) => (
            <NavRow
              key={it.href}
              item={it}
              active={isActive(pathname, it.href)}
              badge={it.href === "/jobs" ? activeJobs : undefined}
            />
          ))}
        </nav>

        <div className="border-t border-[var(--line)] p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-3)] text-xs font-semibold text-[var(--fg-1)]">
              {(user?.displayName ?? user?.username ?? "U").slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-xs font-medium text-[var(--fg-0)]">{user?.displayName ?? user?.username ?? "未登录"}</div>
              <div className="meta truncate">AiAvatar 创作者</div>
            </div>
            <button onClick={() => { logout(); router.push("/login"); }} title="退出登录"
              className="rounded-md p-1.5 text-[var(--fg-3)] transition hover:bg-[var(--bg-2)] hover:text-[var(--fg-1)]">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[var(--line)] bg-[color-mix(in_oklch,var(--bg-0)_82%,transparent)] px-5 backdrop-blur">
          <div className="flex items-center gap-1.5 text-sm">
            <Link href="/library" className="text-[var(--fg-3)] transition hover:text-[var(--fg-1)]">资产中心</Link>
            <ChevronRight className="h-3.5 w-3.5 text-[var(--fg-3)]" />
            <span className="font-medium text-[var(--fg-0)]">{crumb}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/jobs"
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition",
                activeJobs > 0
                  ? "border-[var(--info-soft)] bg-[var(--info-soft)] text-[var(--info)]"
                  : "border-[var(--line)] text-[var(--fg-2)] hover:border-[var(--line-strong)] hover:text-[var(--fg-0)]",
              )}>
              {activeJobs > 0 && <span className="dot animate-pulse" style={{ background: "var(--info)" }} />}
              进行中任务 <span className="num font-semibold">{activeJobs}</span>
            </Link>
            <Link href="/create" className="btn btn-primary btn-sm">
              <Plus className="h-3.5 w-3.5" /> 新建
            </Link>
          </div>
        </header>

        {/* 移动端导航 */}
        <nav className="flex gap-1.5 overflow-x-auto border-b border-[var(--line)] bg-[var(--panel)] px-3 py-2 md:hidden">
          {[...PRIMARY, ...TOOLS].map((it) => {
            const active = isActive(pathname, it.href);
            const Icon = it.icon;
            return (
              <Link key={it.href} href={it.href}
                className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition",
                  active ? "bg-[var(--brand-soft)] font-medium text-[var(--brand-strong)]" : "text-[var(--fg-2)]")}>
                <Icon className="h-3.5 w-3.5" /> {it.label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 overflow-y-auto px-5 py-6">{children}</main>
      </div>
    </div>
  );
}

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmProvider>
      <Shell>{children}</Shell>
    </ConfirmProvider>
  );
}
