"use client";

// ────────────────────────────────────────────────────────────────────────────
// 移动端工作台外壳（v0.45 · 移动 H5 第一期）
//
// 桌面 shell（(workspace)/layout.tsx 的 220px 栅格）在手机上不可用：
// 这里提供窄屏专用导航骨架，由 useIsMobile() 在 <768px 时替换桌面 shell。
//
//   ┌──────────────────────────────┐
//   │ iP  当前页标题      [钱包] (头) │  ← 精简顶栏（含安全区）
//   ├──────────────────────────────┤
//   │                              │
//   │   children（页面内容，可滚）   │  ← main，底部留白避开 tab bar
//   │                              │
//   ├──────────────────────────────┤
//   │ 今日  市场  混剪  分发   更多  │  ← 固定底部 Tab Bar（含安全区）
//   └──────────────────────────────┘
//
// 「更多」与桌面相同的全量导航：直接复用 creator/Sidebar，塞进左侧 Sheet 抽屉，
// 把 layout 已算好的 buildGroups() 原样喂入 —— 导航数据零重复。
// ────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Coins,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  Menu,
  Scissors,
  Send,
  Star,
} from "lucide-react";
import { useAuth } from "@ai-star-eco/api-client";
import { formatCredits } from "@ai-star-eco/api-client/format";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@ai-star-eco/ui/ui/sheet";
import { Avatar, Sidebar, type NavGroup } from "@/components/creator";
import { useCelebrityShell } from "@/lib/celebrity-shell-context";

// 底部 Tab Bar：四个最高频入口 + 「更多」抽屉。其余路由全部走抽屉里的全量导航。
const TABS: {
  icon: LucideIcon;
  label: string;
  href: string;
  match: (p: string) => boolean;
}[] = [
  { icon: LayoutDashboard, label: "今日", href: "/dashboard", match: (p) => p === "/dashboard" },
  { icon: Star, label: "市场", href: "/market", match: (p) => p === "/market" || p.startsWith("/star") },
  { icon: Scissors, label: "混剪", href: "/mixcut", match: (p) => p === "/mixcut" || p.startsWith("/mixcut/") },
  { icon: Send, label: "分发", href: "/distribution", match: (p) => p === "/distribution" || p.startsWith("/distribution/") },
];

export function MobileShell({
  groups,
  title,
  children,
}: {
  groups: NavGroup[];
  title: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/dashboard";
  const [navOpen, setNavOpen] = React.useState(false);
  const { user, logout } = useAuth();
  const { wallet } = useCelebrityShell();

  // 路由变化时自动收起抽屉（点了导航后）。
  React.useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        background: "var(--bg-0)",
        color: "var(--fg-0)",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* 顶栏 ----------------------------------------------------------------- */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          paddingTop: "calc(10px + env(safe-area-inset-top, 0px))",
          borderBottom: "1px solid var(--line)",
          background: "var(--bg-0)",
          flexShrink: 0,
        }}
      >
        <div
          aria-hidden
          style={{
            width: 26,
            height: 26,
            background: "var(--accent)",
            borderRadius: "var(--radius-sm)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            fontSize: 12,
            color: "#fff",
            flexShrink: 0,
          }}
        >
          iP
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--fg-0)",
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
        <Link
          href="/wallet"
          title="积分钱包"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "6px 10px",
            background: "var(--accent-soft)",
            border: "1px solid color-mix(in srgb, var(--accent) 22%, transparent)",
            borderRadius: "var(--radius-pill)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--accent-strong)",
            fontWeight: 600,
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          <Coins size={11} /> {wallet ? formatCredits(wallet.totalBalance) : "—"}
        </Link>
        <Avatar seed={user?.username ?? user?.displayName ?? "anon"} size={30} />
      </header>

      {/* 内容 ----------------------------------------------------------------- */}
      <main
        style={{
          flex: 1,
          overflow: "auto",
          WebkitOverflowScrolling: "touch",
          padding: "16px 14px",
          paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))",
          background: "var(--bg-0)",
        }}
      >
        {children}
      </main>

      {/* 底部 Tab Bar --------------------------------------------------------- */}
      <nav
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          borderTop: "1px solid var(--line)",
          background: "var(--bg-1)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          boxShadow: "0 -1px 10px rgba(31, 26, 20, 0.05)",
          zIndex: 30,
        }}
      >
        {TABS.map((t) => {
          const active = t.match(pathname);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                padding: "8px 0 7px",
                textDecoration: "none",
                color: active ? "var(--accent)" : "var(--fg-3)",
              }}
            >
              <Icon size={19} strokeWidth={active ? 2.4 : 2} />
              <span style={{ fontSize: 10.5, fontWeight: active ? 600 : 500 }}>{t.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          aria-label="打开全部菜单"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
            padding: "8px 0 7px",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            color: navOpen ? "var(--accent)" : "var(--fg-3)",
          }}
        >
          <Menu size={19} strokeWidth={2} />
          <span style={{ fontSize: 10.5, fontWeight: 500 }}>更多</span>
        </button>
      </nav>

      {/* 全量导航抽屉（复用桌面 Sidebar） ------------------------------------- */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent
          side="left"
          className="w-[280px] sm:max-w-[280px] p-0"
          style={{ background: "var(--bg-1)", borderColor: "var(--line)" }}
        >
          <SheetTitle className="sr-only">导航菜单</SheetTitle>
          <SheetDescription className="sr-only">选择要前往的功能页面</SheetDescription>
          {/* 点击任一导航链接（事件冒泡到 a）即收起抽屉 */}
          <div
            style={{ height: "100%" }}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) setNavOpen(false);
            }}
          >
            <Sidebar
              brand={{ initials: "iP", name: "AI 明星带货", meta: "明星带货" }}
              groups={groups}
              footer={
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar seed={user?.username ?? user?.displayName ?? "anon"} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: "var(--fg-0)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {user?.displayName ?? "未登录"}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--fg-2)",
                        fontFamily: "var(--font-mono)",
                        letterSpacing: 0.3,
                      }}
                    >
                      {user?.studio?.name ?? "还未绑定工作室"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={logout}
                    title="退出当前账号"
                    aria-label="退出当前账号"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--fg-3)",
                      display: "inline-flex",
                      padding: 4,
                    }}
                  >
                    <LogOut size={14} />
                  </button>
                </div>
              }
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
