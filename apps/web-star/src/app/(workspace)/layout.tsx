"use client";

// (workspace) 布局 — 明星商务工作台 Shell。
// 浅色主题：顶栏（明星身份 + 待办铃铛 + 等级徽章）+ 左侧 240px 分组导航。
// <1024px 时侧导航折叠为顶部横向 Tab（产品文档 §4.7 响应式约束）。

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AlertCircle, Bell, LayoutGrid, LogOut, Star } from "lucide-react";
import { useAuth, AuthApi } from "@ai-star-eco/api-client";
import { STAR_NAV_GROUPS } from "@/constants/star-ui";
import { StarShellProvider, useStarShell } from "@/lib/star-shell-context";
import { formatWan } from "@/lib/format";
import { Modal } from "@/components/star/page-kit";

function navBadgeCount(badgeKey: string | undefined, byModule: Map<string, number>): number {
  if (!badgeKey) return 0;
  return byModule.get(badgeKey) ?? 0;
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, hasPlatformAccess, logout } = useAuth();
  const { profile, profileLoading, overview } = useStarShell();
  const mobileNavRef = React.useRef<HTMLElement>(null);
  const [moduleSheetOpen, setModuleSheetOpen] = React.useState(false);

  // <1024 顶部横向 Tab：路由变化时把活跃模块滚动到可视区中部
  React.useEffect(() => {
    const active = mobileNavRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [pathname]);

  // 未入驻 → 引导到入驻页（onboard 在 workspace 外，公共布局）
  React.useEffect(() => {
    if (!profileLoading && profile === null && user) {
      router.replace("/onboard");
    }
  }, [profileLoading, profile, user, router]);

  const byModule = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const item of overview?.pendingByModule ?? []) m.set(item.module, item.count);
    return m;
  }, [overview]);

  const totalPending = overview?.pendingTotal ?? 0;

  if (user && !hasPlatformAccess) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-6">
        <div className="star-card max-w-md w-full p-8 text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "var(--brand-soft)" }}>
            <AlertCircle className="w-6 h-6" style={{ color: "var(--brand)" }} />
          </div>
          <h2 className="mt-4 text-base font-bold" style={{ color: "var(--ink-0)" }}>未开通明星商务工作台</h2>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--ink-1)" }}>
            当前账号未被授予「明星商务工作台」访问权限。请联系平台运营为账号开通 star 平台后再试。
          </p>
          <button
            onClick={() => { AuthApi.logout(); logout(); }}
            className="mt-6 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: "var(--ink-0)" }}
          >
            <LogOut className="w-4 h-4" /> 退出登录
          </button>
        </div>
      </div>
    );
  }

  const navContent = (horizontal: boolean) => (
    <nav
      ref={horizontal ? mobileNavRef : undefined}
      className={horizontal ? "flex items-center gap-1 overflow-x-auto scrollbar-none overscroll-x-contain px-3 py-1.5" : "flex-1 px-3 pb-4 overflow-y-auto scrollbar-thin"}
    >
      {STAR_NAV_GROUPS.map((group, gi) => (
        <div key={group.label} className={horizontal ? "flex items-center gap-1 shrink-0" : "mb-1"}>
          {!horizontal && (
            <div className="px-2.5 pt-5 pb-1.5 text-[10px] font-bold tracking-widest uppercase" style={{ color: "var(--ink-2)" }}>
              {group.label}
            </div>
          )}
          {horizontal && gi > 0 && <span aria-hidden className="w-px h-4 mx-1 shrink-0" style={{ background: "var(--line-strong)" }} />}
          {group.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            const badge = navBadgeCount(item.badgeKey, byModule);
            return (
              <Link
                key={item.id}
                href={item.href}
                data-active={active || undefined}
                className={
                  horizontal
                    ? "relative flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors shrink-0"
                    : "relative w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left mb-0.5 transition-colors"
                }
                style={
                  active
                    ? { background: `${item.color}12`, border: `1px solid ${item.color}2e`, color: "var(--ink-0)" }
                    : { background: "transparent", border: "1px solid transparent", color: "var(--ink-1)" }
                }
              >
                {active && !horizontal && (
                  <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full" style={{ background: item.color }} />
                )}
                <Icon className="w-4 h-4 shrink-0" style={{ color: active ? item.color : "var(--ink-2)" }} />
                <span className={horizontal ? "" : "text-[13px] font-semibold flex-1 truncate"}>{item.label}</span>
                {badge > 0 && (
                  <span
                    className="shrink-0 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold px-1 tabular"
                    style={{ background: `${item.color}1a`, color: item.color }}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-dvh" style={{ background: "var(--bg-0)" }}>
      {/* ── 顶栏 ── */}
      <header
        className="flex items-center justify-between px-4 sm:px-5 h-[57px] sticky top-0 z-20"
        style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--line)" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--gradient-star)" }}>
            <Star className="w-4 h-4 text-white" fill="currentColor" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold truncate" style={{ color: "var(--ink-0)" }}>明星商务工作台</div>
            <div className="text-[10px] truncate" style={{ color: "var(--star-gold-deep)" }}>
              {profile ? `✦ ${profile.name} · ${profile.agentView ? "经纪人视角" : "本人视角"}` : "✦ 加载中…"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link href="/dashboard" className="relative p-1 touch-hit" aria-label="待办通知">
            <Bell className="w-5 h-5" style={{ color: "var(--ink-1)" }} />
            {totalPending > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center text-[9px] font-bold text-white tabular"
                style={{ background: "var(--brand)" }}
              >
                {totalPending}
              </span>
            )}
          </Link>
          {profile && (
            <div
              className="text-xs font-semibold rounded-full px-3 py-1 hidden sm:block"
              style={{ color: "var(--star-gold-deep)", border: "1px solid #f59e0b55", background: "#f59e0b0d" }}
            >
              {profile.tierLabel} · {formatWan(profile.fans)}粉
            </div>
          )}
          <button
            onClick={() => { AuthApi.logout(); logout(); }}
            className="p-1 touch-hit transition hover:opacity-70"
            title="退出登录"
            aria-label="退出登录"
          >
            <LogOut className="w-4 h-4" style={{ color: "var(--ink-2)" }} />
          </button>
        </div>
      </header>

      {/* ── <1024：顶部横向导航（横滑 Tab + 「全部」模块抽屉） ── */}
      <div className="star-topnav-mobile sticky top-[57px] z-10 flex items-stretch" style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--line)" }}>
        <div className="relative flex-1 min-w-0">
          {navContent(true)}
          {/* 右缘渐隐：提示还有更多模块可横滑 */}
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-8" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.92))" }} />
        </div>
        <button
          onClick={() => setModuleSheetOpen(true)}
          className="shrink-0 flex items-center gap-1 px-3.5 text-[13px] font-semibold transition active:bg-[var(--bg-2)]"
          style={{ borderLeft: "1px solid var(--line)", color: "var(--ink-1)" }}
          aria-label="打开全部模块"
        >
          <LayoutGrid className="w-4 h-4" style={{ color: "var(--ink-2)" }} />
          全部
        </button>
      </div>

      {/* 全部模块抽屉（<1024 顶部 Tab 的全景入口） */}
      <Modal open={moduleSheetOpen} title="全部模块" onClose={() => setModuleSheetOpen(false)}>
        <div className="space-y-4">
          {STAR_NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: "var(--ink-2)" }}>{group.label}</div>
              <div className="grid grid-cols-4 gap-2">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  const badge = navBadgeCount(item.badgeKey, byModule);
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => setModuleSheetOpen(false)}
                      className="relative flex flex-col items-center gap-1.5 rounded-xl px-1 py-2.5 min-h-[64px] text-center transition active:scale-[0.97]"
                      style={active
                        ? { background: `${item.color}12`, border: `1px solid ${item.color}2e` }
                        : { background: "var(--bg-0)", border: "1px solid var(--line)" }}
                    >
                      <Icon className="w-5 h-5" style={{ color: item.color }} />
                      <span className="text-[11px] font-semibold leading-tight" style={{ color: active ? "var(--ink-0)" : "var(--ink-1)" }}>{item.label}</span>
                      {badge > 0 && (
                        <span
                          className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[9px] font-bold px-1 tabular"
                          style={{ background: `${item.color}1a`, color: item.color }}
                        >
                          {badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* ── 主体 ── */}
      <div className="flex" style={{ minHeight: "calc(100dvh - 57px)" }}>
        {/* 侧导航（≥1024） */}
        <aside
          className="star-sidebar-desktop w-[240px] shrink-0 flex flex-col sticky"
          style={{ background: "var(--bg-1)", borderRight: "1px solid var(--line)", top: 57, height: "calc(100dvh - 57px)" }}
        >
          <div className="p-3" style={{ borderBottom: "1px solid var(--line)" }}>
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl" style={{ background: "#f59e0b0d", border: "1px solid #f59e0b26" }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 overflow-hidden" style={{ background: "var(--gradient-star)" }}>
                {profile?.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
                ) : (
                  <Star className="w-4 h-4 text-white" fill="currentColor" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-bold truncate" style={{ color: "var(--ink-0)" }}>{profile?.name ?? "—"}</div>
                <div className="text-[10px] truncate" style={{ color: "var(--star-gold-deep)" }}>
                  {profile ? `${profile.tierLabel}艺人 · ${formatWan(profile.fans)}粉` : "档案加载中"}
                </div>
              </div>
            </div>
          </div>
          {navContent(false)}
          {totalPending > 0 && (
            <div className="p-3" style={{ borderTop: "1px solid var(--line)" }}>
              <Link href="/dashboard" className="flex items-center gap-2 text-[11px] rounded-lg p-2.5 transition hover:brightness-95" style={{ background: "#f59e0b12", color: "var(--star-gold-deep)" }}>
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="font-semibold">{totalPending} 项待处理</span>
              </Link>
            </div>
          )}
        </aside>

        {/* 内容区 */}
        <main className="flex-1 min-w-0" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>{children}</main>
      </div>
    </div>
  );
}

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <StarShellProvider>
      <Shell>{children}</Shell>
    </StarShellProvider>
  );
}
