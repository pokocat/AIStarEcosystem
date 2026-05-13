"use client";

// /console/* Creator-Friendly 工作台 shell。
// 视觉来源：AI IP Design Directions 02（奶油底 + 紫罗兰 active + 大圆角 + 柔阴影）。

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Coins,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  PieChart,
  Search,
  ShoppingBag,
  Star,
  Video,
  X,
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
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        borderRadius: "var(--radius-md)",
        textDecoration: "none",
        background: active ? "var(--accent-soft)" : "transparent",
        color: active ? "var(--accent)" : "var(--fg-1)",
        fontSize: 13.5,
        fontWeight: active ? 600 : 500,
        fontFamily: "var(--font-sans)",
        transition: "background 160ms, color 160ms",
        marginBottom: 2,
      }}
    >
      <Icon size={16} />
      <span>{item.label}</span>
    </Link>
  );
}

function TopBar() {
  const { wallet } = useCelebrityShell();
  const { user, logout } = useAuth();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "14px 28px",
        borderBottom: "1px solid var(--line)",
        background: "var(--bg-0)",
      }}
    >
      <div
        className="creator-mono"
        style={{ fontSize: 11.5, color: "var(--fg-2)", letterSpacing: 0.3 }}
      >
        AI 明星带货 <span style={{ color: "var(--fg-3)" }}>/</span> 工作台
      </div>

      <div style={{ flex: 1 }} />

      {/* 搜索框 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px",
          background: "var(--bg-1)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-pill)",
          fontSize: 12.5,
          color: "var(--fg-2)",
          minWidth: 260,
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <Search size={13} />
        <span style={{ fontFamily: "var(--font-sans)" }}>搜索明星 / 项目 / 视频…</span>
        <span
          className="creator-mono"
          style={{
            marginLeft: "auto",
            padding: "1px 6px",
            border: "1px solid var(--line-2)",
            borderRadius: 4,
            fontSize: 10,
            color: "var(--fg-3)",
          }}
        >
          ⌘K
        </span>
      </div>

      {/* 积分徽章 */}
      <div
        title="积分余额"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 14px",
          background: "var(--accent-soft)",
          border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
          borderRadius: "var(--radius-pill)",
        }}
      >
        <Coins size={13} color="var(--accent)" />
        <span
          className="creator-mono"
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--accent-strong)",
            letterSpacing: 0.2,
          }}
        >
          {wallet ? formatCredits(wallet.totalBalance) : "—"}
        </span>
      </div>

      {/* 通知按钮 */}
      <button
        title="通知"
        style={{
          padding: 9,
          borderRadius: "50%",
          background: "var(--bg-1)",
          border: "1px solid var(--line)",
          color: "var(--fg-2)",
          cursor: "pointer",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <Bell size={14} />
      </button>

      {/* 用户头像 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "5px 16px 5px 5px",
          background: "var(--bg-1)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-pill)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "var(--gradient-violet)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {user?.displayName?.[0] ?? "?"}
        </div>
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: "var(--fg-0)",
            maxWidth: 120,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {user?.displayName ?? "未登录"}
        </span>
      </div>

      <button
        onClick={logout}
        title="退出登录"
        style={{
          padding: 9,
          borderRadius: "50%",
          background: "var(--bg-1)",
          border: "1px solid var(--line)",
          color: "var(--fg-2)",
          cursor: "pointer",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <LogOut size={14} />
      </button>
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "20px 22px",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "var(--radius-md)",
            background: "var(--gradient-violet)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <Megaphone size={16} color="#ffffff" strokeWidth={2.4} />
        </div>
        <div style={{ lineHeight: 1.2 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "var(--font-display)",
              color: "var(--fg-0)",
            }}
          >
            AI 明星带货
          </div>
          <div className="creator-eyebrow" style={{ fontSize: 9.5 }}>
            v0.5 · creator
          </div>
        </div>
      </div>

      <nav style={{ padding: "14px 14px", flex: 1, overflowY: "auto" }}>
        <div
          className="creator-eyebrow"
          style={{ padding: "6px 10px 8px", fontSize: 10 }}
        >
          Workspace
        </div>
        {SIDEBAR_ITEMS.map((item) => (
          <SidebarLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </nav>

      <div style={{ padding: "14px 14px", borderTop: "1px solid var(--line)" }}>
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "9px 12px",
            borderRadius: "var(--radius-md)",
            fontSize: 12.5,
            color: "var(--fg-2)",
            textDecoration: "none",
            fontFamily: "var(--font-sans)",
          }}
        >
          ← 返回首页
        </Link>
      </div>
    </>
  );

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        background: "var(--bg-0)",
        color: "var(--fg-0)",
        overflow: "hidden",
        fontFamily: "var(--font-sans)",
      }}
    >
      <aside
        style={{
          display: "flex",
          flexDirection: "column",
          width: 260,
          flexShrink: 0,
          background: "var(--bg-1)",
          borderRight: "1px solid var(--line)",
        }}
      >
        {sidebar}
      </aside>

      {mobileOpen && (
        <>
          <div
            onClick={() => setMobileOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(31,26,20,0.4)",
              zIndex: 40,
            }}
          />
          <aside
            style={{
              position: "fixed",
              left: 0,
              top: 0,
              bottom: 0,
              width: 260,
              background: "var(--bg-1)",
              borderRight: "1px solid var(--line)",
              zIndex: 50,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="关闭侧栏"
              style={{
                position: "absolute",
                top: 14,
                right: 14,
                color: "var(--fg-2)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
            >
              <X size={18} />
            </button>
            {sidebar}
          </aside>
        </>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <TopBar />
        <main
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "28px 32px",
            background: "var(--bg-0)",
          }}
        >
          {children}
        </main>
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
