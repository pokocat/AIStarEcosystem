"use client";

// Premium 风的 drama 工作台 shell：220px sidebar + topbar + main outlet。
// 视觉来源：AI IP Design Directions 03（dark + gold + glass）。
// 鉴权由 AppProviders 中 AuthProvider 处理（PUBLIC_PREFIXES 不含 /console）。

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Clapperboard,
  Coins,
  Compass,
  Film,
  LayoutDashboard,
  LogOut,
  PenTool,
  Search,
  Settings,
  Share2,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";
import { AccountApi, useAuth } from "@ai-star-eco/api-client";
import type { Wallet } from "@ai-star-eco/types/wallet";

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    title: "Workspace",
    items: [
      { href: "/console", icon: LayoutDashboard, label: "总览" },
      { href: "/console?tab=cast", icon: Users, label: "演员 IP 阵容" },
      { href: "/console?tab=incubator", icon: Wand2, label: "孵化新演员" },
      { href: "/console?tab=scripts", icon: PenTool, label: "脚本工坊" },
      { href: "/console?tab=projects", icon: Film, label: "项目流水线" },
    ],
  },
  {
    title: "Distribution",
    items: [
      { href: "/console?tab=distribution", icon: Share2, label: "多平台分发" },
      { href: "/console?tab=insights", icon: BarChart3, label: "数据洞察" },
      { href: "/console?tab=trends", icon: Compass, label: "趋势雷达" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/console?tab=settings", icon: Settings, label: "工作室设置" },
    ],
  },
];

function Sidebar() {
  const pathname = usePathname();
  const search = useSearchParams();
  const currentTab = search?.get("tab") ?? "";
  const { user } = useAuth();
  return (
    <aside
      style={{
        background: "var(--bg-1)",
        borderRight: "1px solid var(--line)",
        padding: "20px 0",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <div
        style={{
          padding: "0 20px 18px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: "var(--radius-md)",
            background: "var(--gradient-gold)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 16px rgba(212,175,106,0.25)",
          }}
        >
          <Clapperboard size={14} color="#1a1410" strokeWidth={2.4} />
        </div>
        <div style={{ lineHeight: 1.2 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "var(--font-display)",
            }}
          >
            AI 短剧
          </div>
          <div className="eyebrow" style={{ fontSize: 9 }}>
            v0.5 · cinematic
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 12px", flex: 1, overflowY: "auto" }}>
        {GROUPS.map((g, gi) => (
          <div key={gi}>
            <div
              className="eyebrow"
              style={{
                padding: gi === 0 ? "8px 10px 8px" : "20px 10px 8px",
              }}
            >
              {g.title}
            </div>
            {g.items.map((it) => {
              const Icon = it.icon;
              const [path, query] = it.href.split("?");
              const targetTab = query?.match(/tab=([^&]+)/)?.[1] ?? "";
              // 仅当路径相同 && tab 也对得上时高亮（含"总览"= 无 tab）
              const isActive =
                pathname === path && currentTab === targetTab;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "9px 10px",
                    borderRadius: "var(--radius-md)",
                    background: isActive
                      ? "color-mix(in srgb, var(--accent) 10%, transparent)"
                      : "transparent",
                    color: isActive ? "var(--fg-0)" : "var(--fg-1)",
                    fontSize: 13,
                    fontWeight: isActive ? 500 : 400,
                    marginBottom: 2,
                    border: isActive
                      ? "1px solid color-mix(in srgb, var(--accent) 25%, transparent)"
                      : "1px solid transparent",
                    transition: "background 160ms ease, border-color 160ms ease",
                  }}
                >
                  <Icon size={15} color={isActive ? "var(--accent)" : "var(--fg-2)"} />
                  <span>{it.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div
        style={{
          padding: "14px 18px",
          borderTop: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "var(--bg-3)",
            border: "1px solid var(--line-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--fg-1)",
          }}
        >
          {user?.displayName?.[0] ?? "?"}
        </div>
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
            className="mono"
            style={{ fontSize: 10, color: "var(--fg-2)", letterSpacing: 0.3 }}
          >
            {user?.studio?.name ?? "drama studio"}
          </div>
        </div>
      </div>
    </aside>
  );
}

function Topbar({ children }: { children?: React.ReactNode }) {
  const { logout } = useAuth();
  const [wallet, setWallet] = React.useState<Wallet | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    AccountApi.getMyWallet()
      .then((w) => {
        if (!cancelled) setWallet(w);
      })
      .catch(() => {
        /* 静默：未登录或后端不在 */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "14px 28px",
        borderBottom: "1px solid var(--line)",
        background: "rgba(10,8,16,0.6)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div className="mono" style={{ fontSize: 11, color: "var(--fg-2)", letterSpacing: 0.4 }}>
        AI Short Drama <span style={{ color: "var(--fg-3)" }}>/</span> Workspace
      </div>
      <div style={{ flex: 1 }} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 12px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid var(--line-2)",
          borderRadius: "var(--radius-md)",
          fontSize: 12,
          color: "var(--fg-2)",
          fontFamily: "var(--font-mono)",
          minWidth: 280,
        }}
      >
        <Search size={13} />
        <span>搜索剧集、演员、脚本…</span>
        <span
          style={{
            marginLeft: "auto",
            padding: "1px 6px",
            border: "1px solid var(--line-2)",
            borderRadius: 3,
            fontSize: 10,
          }}
        >
          ⌘K
        </span>
      </div>

      <div
        title="积分余额"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 12px",
          background: "color-mix(in srgb, var(--accent) 10%, transparent)",
          border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
          borderRadius: "var(--radius-pill)",
        }}
      >
        <Coins size={13} color="var(--accent)" />
        <span
          className="mono"
          style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", letterSpacing: 0.3 }}
        >
          {wallet ? wallet.totalBalance.toLocaleString("zh-CN") : "—"}
        </span>
      </div>

      {children}

      <button
        onClick={logout}
        title="退出登录"
        style={{
          padding: 8,
          borderRadius: "var(--radius-md)",
          background: "transparent",
          border: "1px solid var(--line-2)",
          color: "var(--fg-2)",
          cursor: "pointer",
        }}
      >
        <LogOut size={14} />
      </button>
    </header>
  );
}

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "240px 1fr",
        height: "100vh",
        background: "var(--bg-0)",
        color: "var(--fg-0)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <Sidebar />
      <main style={{ display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
        {/* 微弱的渐变光晕，给整个工作台一抹电影感 */}
        <div
          aria-hidden
          style={{
            pointerEvents: "none",
            position: "absolute",
            top: -200,
            right: -160,
            width: 600,
            height: 400,
            background: "var(--gradient-hero)",
            opacity: 0.08,
            filter: "blur(140px)",
          }}
        />
        <Topbar />
        <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", position: "relative", zIndex: 2 }}>
          {children}
        </div>
        {/* 角标 */}
        <div
          style={{
            position: "absolute",
            bottom: 16,
            right: 18,
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 10,
            color: "var(--fg-3)",
            fontFamily: "var(--font-mono)",
            letterSpacing: 0.4,
          }}
        >
          <Sparkles size={10} />
          CINEMATIC · v0.5
        </div>
      </main>
    </div>
  );
}
