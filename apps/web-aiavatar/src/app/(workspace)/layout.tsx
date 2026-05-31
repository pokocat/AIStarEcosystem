"use client";

// AiAvatar 中心工作台 shell（route group `(workspace)` 不出现在 URL）。
// 浅色工作台侧栏 + 顶栏（面包屑 + Provider 健康入口 + 进行中任务徽标 + 账号）。

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Boxes, FlaskConical, GalleryVerticalEnd, Gauge, LayoutGrid, ListChecks,
  LogOut, Plus, ScrollText, ShieldCheck, Sparkles, Activity,
} from "lucide-react";
import { useAuth } from "@ai-star-eco/api-client";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { ConfirmProvider } from "@/components/common/confirm-dialog";
import { useJobList } from "@/lib/use-job-poll";

interface NavItem { label: string; href: string; icon: React.ComponentType<{ className?: string }>; }
interface NavGroup { title: string; items: NavItem[]; }

const GROUPS: NavGroup[] = [
  {
    title: "资产",
    items: [
      { label: "资产总库", href: "/library", icon: LayoutGrid },
      { label: "新建AiAvatar", href: "/create", icon: Plus },
    ],
  },
  {
    title: "工坊",
    items: [
      { label: "AI 模板中心", href: "/templates", icon: Sparkles },
      { label: "人像精调工作台", href: "/refine", icon: FlaskConical },
      { label: "真人授权管理", href: "/licenses", icon: ShieldCheck },
    ],
  },
  {
    title: "运行",
    items: [
      { label: "异步任务中心", href: "/jobs", icon: ListChecks },
      { label: "能力健康", href: "/health", icon: Activity },
    ],
  },
];

const CRUMB: Record<string, string> = {
  library: "资产总库", create: "新建AiAvatar", avatar: "资产详情", templates: "AI 模板中心",
  refine: "人像精调工作台", licenses: "真人授权管理", jobs: "异步任务中心", health: "能力健康",
};

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { jobs } = useJobList(3000);
  const activeJobs = jobs.filter((j) => j.status === "running" || j.status === "queued").length;

  const seg = pathname.split("/").filter(Boolean)[0] ?? "library";
  const crumb = CRUMB[seg] ?? "AiAvatar 中心";

  return (
    <div className="flex min-h-screen bg-[var(--bg-0)] text-[var(--fg-0)]">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-zinc-800 bg-[var(--bg-1)] md:flex">
        <Link href="/library" className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-zinc-950">
            <Boxes className="h-4.5 w-4.5" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-zinc-100">AiAvatar 中心</div>
            <div className="font-mono text-[10px] text-zinc-500">AIAVATAR ASSETS</div>
          </div>
        </Link>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div className="px-2 pb-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-600">{g.title}</div>
              <div className="space-y-0.5">
                {g.items.map((it) => {
                  const active = pathname === it.href || (it.href !== "/library" && pathname.startsWith(it.href));
                  const Icon = it.icon;
                  const badge = it.href === "/jobs" && activeJobs > 0 ? activeJobs : undefined;
                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
                        active ? "bg-amber-500/15 text-amber-300" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{it.label}</span>
                      {badge != null && (
                        <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-zinc-950">{badge}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-zinc-800 p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-xs font-semibold text-zinc-100">
              {(user?.displayName ?? user?.username ?? "U").slice(0, 1).toUpperCase()}
            </span>
            <div className="flex-1 leading-tight">
              <div className="truncate text-xs text-zinc-200">{user?.displayName ?? user?.username ?? "未登录"}</div>
              <div className="font-mono text-[10px] text-zinc-500">AiAvatar创作者</div>
            </div>
            <button onClick={() => { logout(); router.push("/login"); }} title="退出登录"
              className="rounded-md p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-200">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-zinc-800 bg-[var(--bg-0)]/85 px-5 backdrop-blur">
          <div className="flex items-center gap-2 text-sm">
            <GalleryVerticalEnd className="h-4 w-4 text-zinc-500" />
            <span className="text-zinc-500">AiAvatar 中心</span>
            <span className="text-zinc-700">/</span>
            <span className="text-zinc-100">{crumb}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/jobs" className="flex items-center gap-1.5 rounded-lg border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-zinc-600">
              <Gauge className="h-3.5 w-3.5" />
              进行中 <span className="font-mono text-amber-400">{activeJobs}</span>
            </Link>
            <Link href="/create" className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-400">
              <Plus className="h-3.5 w-3.5" /> 新建AiAvatar
            </Link>
          </div>
        </header>

        {/* 移动端顶部 tab（简化） */}
        <nav className="flex gap-1 overflow-x-auto border-b border-zinc-800 px-3 py-2 md:hidden">
          {GROUPS.flatMap((g) => g.items).map((it) => {
            const active = pathname === it.href || (it.href !== "/library" && pathname.startsWith(it.href));
            return (
              <Link key={it.href} href={it.href}
                className={cn("shrink-0 rounded-full px-3 py-1 text-xs", active ? "bg-amber-500/15 text-amber-300" : "text-zinc-400")}>
                {it.label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 overflow-y-auto p-5">{children}</main>
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
