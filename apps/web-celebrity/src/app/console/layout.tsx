"use client";

// ─────────────────────────────────────────────────────────────────────────────
// /console/* 的工作台 shell — 独立侧栏 + 顶栏，明星带货专属。
// 与 apps/web 的 producer/layout.tsx (510 行) 不同：
//   - 只承载 celebrity 一条产品线，无产品切换；
//   - 不暴露 activeArtist 切换（celebrity 用 CelebrityStar，按项目选）；
//   - shell context 只暴露 wallet，其它（notifications/commandPalette）后续按需引入。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Star,
  ShoppingBag,
  Megaphone,
  Video,
  Scissors,
  PieChart,
  Wallet as WalletIcon,
  LogOut,
  Menu,
  X,
  Coins,
} from "lucide-react";
import { useAuth } from "@ai-star-eco/api-client";
import { formatCredits } from "@ai-star-eco/api-client/format";
import { CelebrityShellProvider, useCelebrityShell } from "@/lib/celebrity-shell-context";

interface SidebarItem {
  href: string;
  icon: React.ElementType;
  label: string;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { href: "/console", icon: LayoutDashboard, label: "总览" },
  { href: "/console?tab=market", icon: Star, label: "明星市场" },
  { href: "/console?tab=projects", icon: Megaphone, label: "我的项目" },
  { href: "/console?tab=library", icon: Video, label: "视频中心" },
  { href: "/console?tab=products", icon: ShoppingBag, label: "商品库" },
  { href: "/console?tab=data", icon: PieChart, label: "数据中心" },
];

function SidebarLink({ item, active }: { item: SidebarItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
        active
          ? "bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-pink-500/15 text-amber-200 border border-amber-500/20"
          : "text-gray-400 hover:bg-white/[0.04] hover:text-white"
      }`}
    >
      <Icon size={18} />
      <span className="font-medium">{item.label}</span>
    </Link>
  );
}

function TopBar() {
  const { wallet } = useCelebrityShell();
  const { user, logout } = useAuth();
  return (
    <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-white/5 bg-black/50 backdrop-blur-lg">
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <span className="hidden md:inline">AI 明星带货 · 工作台</span>
      </div>
      <div className="flex items-center gap-3">
        <div
          title="积分余额"
          className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1.5"
        >
          <Coins className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-semibold text-amber-300 tabular-nums">
            {wallet ? formatCredits(wallet.totalBalance) : "—"}
          </span>
        </div>
        <div className="flex items-center gap-2 bg-white/[0.03] border border-white/5 rounded-full pl-1 pr-3 py-1">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500/40 to-pink-500/40 border border-amber-500/30 flex items-center justify-center text-[10px] font-bold">
            {user?.displayName?.[0] ?? "?"}
          </div>
          <span className="text-xs font-semibold text-gray-200 hidden sm:block max-w-[140px] truncate">
            {user?.displayName ?? "未登录"}
          </span>
        </div>
        <button
          onClick={logout}
          title="退出登录"
          className="p-2 rounded-lg text-gray-400 hover:bg-white/[0.06] hover:text-white transition"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const isActive = (href: string) => {
    const [path] = href.split("?");
    if (path === "/console") return pathname === "/console";
    return pathname?.startsWith(path) ?? false;
  };

  const sidebar = (
    <>
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 via-orange-500 to-pink-500 flex items-center justify-center shadow-md">
          <Megaphone className="w-4 h-4 text-white" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            AI 明星带货
          </div>
          <div className="text-[10px] text-gray-500 uppercase tracking-[0.18em]">AI Star Eco</div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {SIDEBAR_ITEMS.map((item) => (
          <SidebarLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </nav>
      <div className="px-3 py-3 border-t border-white/5">
        <Link
          href="/"
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-white/[0.04] hover:text-white transition"
        >
          ← 返回 landing
        </Link>
      </div>
    </>
  );

  return (
    <div className="h-screen flex bg-black text-white overflow-hidden">
      <aside className="hidden md:flex flex-col w-[260px] border-r border-white/5 shrink-0">
        {sidebar}
      </aside>

      {mobileOpen && (
        <>
          <div
            onClick={() => setMobileOpen(false)}
            className="md:hidden fixed inset-0 bg-black/60 z-40"
          />
          <aside className="md:hidden fixed left-0 top-0 bottom-0 w-[260px] bg-black border-r border-white/10 z-50 flex flex-col">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 text-gray-400"
              aria-label="关闭侧栏"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebar}
          </aside>
        </>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/5">
          <button onClick={() => setMobileOpen(true)} className="text-gray-400">
            <Menu className="w-5 h-5" />
          </button>
        </div>
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <CelebrityShellProvider>
      <Shell>{children}</Shell>
    </CelebrityShellProvider>
  );
}
