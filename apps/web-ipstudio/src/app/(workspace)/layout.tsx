"use client";

// (workspace) 布局 —— 工作台外壳。极简顶栏（画布页自己有一条工作栏，这里不抢空间）。
// v0.149+：已登录但账号未开通「数字资产平台」时渲染开通页（AI IP 工作台与其共用开通）。

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IdCard, Layers, LogOut, Sparkles } from "lucide-react";
import { AuthApi, useAuth } from "@ai-star-eco/api-client";
import { EnrollmentGate } from "@ai-star-eco/landing";

/**
 * 顶栏导航 —— 顺序就是这条链：造形象 → 登记资产 → 对外发布。
 * 三段各自是一个页面，别把它们的先后顺序打乱。
 */
const NAV = [
  { href: "/projects", label: "项目", icon: Sparkles },
  { href: "/assets", label: "资产", icon: Layers },
  { href: "/cards", label: "名片", icon: IdCard },
];

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { user, hasPlatformAccess, logout } = useAuth();
  const pathname = usePathname() ?? "";

  if (user && !hasPlatformAccess) {
    return (
      <EnrollmentGate
        product="aiavatar"
        productLabel="数字资产平台"
        onLogout={() => {
          AuthApi.logout();
          logout();
        }}
        theme={{
          bg: "var(--canvas)",
          surface: "var(--surface)",
          fg: "var(--ink)",
          fgMuted: "var(--ink-2)",
          accent: "var(--accent)",
          accentFg: "var(--accent-fg)",
          border: "var(--line-2)",
          radius: "15px",
        }}
      />
    );
  }

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: "var(--canvas)" }}>
      {/* 品牌顶栏：与 landing 同一条深群青，紧接其下的工作面保持浅色（design.md §6） */}
      <header
        className="on-blue shrink-0 flex items-center justify-between px-5 h-[52px] sticky top-0 z-30"
        style={{ background: "var(--blue-800)", borderBottom: "1px solid var(--on-blue-line)" }}
      >
        <div className="flex items-center gap-5 min-w-0">
          <Link href="/projects" className="flex items-baseline gap-2.5 min-w-0 shrink-0">
            <span className="asset-name text-[17px] truncate" style={{ color: "var(--on-blue)" }}>AI IP 工作台</span>
            <span
              className="hidden lg:inline text-[10px] font-semibold tracking-[0.12em]"
              style={{ fontFamily: "var(--font-mono)", color: "var(--action)" }}
            >
              IP STUDIO
            </span>
          </Link>
          <nav className="flex items-center gap-1 min-w-0">
            {NAV.map(({ href, label, icon: Icon }) => {
              // 画布页 /projects/<id> 也算在「项目」下 —— 前缀匹配，别在深层页面里丢掉高亮
              const on = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={on ? "page" : undefined}
                  className="h-8 px-2.5 sm:px-3 rounded-[9px] inline-flex items-center gap-1.5 text-[13px] font-semibold transition shrink-0"
                  style={{
                    background: on ? "var(--on-blue-fill)" : "transparent",
                    color: on ? "var(--on-blue)" : "var(--on-blue-2)",
                  }}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {user?.displayName || user?.username ? (
            <span className="text-[12px] max-w-[10rem] truncate" style={{ color: "var(--on-blue-2)" }}>
              {user.displayName || user.username}
            </span>
          ) : null}
          <button
            onClick={() => { AuthApi.logout(); logout(); }}
            className="p-1 rounded transition hover:opacity-75"
            title="退出登录"
            aria-label="退出登录"
          >
            <LogOut className="w-4 h-4" style={{ color: "var(--on-blue)" }} />
          </button>
        </div>
      </header>
      <main className="flex-1 min-h-0 min-w-0">{children}</main>
    </div>
  );
}
