"use client";

// (workspace) 布局 —— 工作台外壳。极简顶栏（画布页自己有一条工作栏，这里不抢空间）。
// v0.149+：已登录但账号未开通「数字资产平台」时渲染开通页（AI IP 工作台与其共用开通）。

import * as React from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { AuthApi, useAuth } from "@ai-star-eco/api-client";
import { EnrollmentGate } from "@ai-star-eco/landing";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { user, hasPlatformAccess, logout } = useAuth();

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
          accent: "var(--primary)",
          accentFg: "var(--on-primary)",
          border: "var(--line-2)",
          radius: "15px",
        }}
      />
    );
  }

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: "var(--canvas)" }}>
      <header
        className="shrink-0 flex items-center justify-between px-5 h-[52px] sticky top-0 z-30"
        style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--line)" }}
      >
        <Link href="/projects" className="flex items-baseline gap-2.5 min-w-0">
          <span className="asset-name text-[17px] truncate" style={{ color: "var(--ink)" }}>AI IP 工作台</span>
          <span className="reg hidden sm:inline">IP STUDIO</span>
        </Link>
        <div className="flex items-center gap-3 shrink-0">
          {user?.displayName || user?.username ? (
            <span className="text-[12px] max-w-[10rem] truncate" style={{ color: "var(--ink-2)" }}>
              {user.displayName || user.username}
            </span>
          ) : null}
          <button
            onClick={() => { AuthApi.logout(); logout(); }}
            className="p-1 transition hover:opacity-70"
            title="退出登录"
            aria-label="退出登录"
          >
            <LogOut className="w-4 h-4" style={{ color: "var(--ink-3)" }} />
          </button>
        </div>
      </header>
      <main className="flex-1 min-h-0 min-w-0">{children}</main>
    </div>
  );
}
