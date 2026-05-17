"use client";

// 工作台 shell（route group `(workspace)` 不在 URL 出现）。
// Sidebar 220px：紫色 iP mark + WORKSPACE 分组 + DRAMA 分组 + 底部"今日提示"小贴士
// 一级路由：/dashboard /market /cast /projects /products /library /data
// Topbar：breadcrumb + 搜索 + Export + accent "+ New" + 圆头像

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Coins,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Plus,
  Scissors,
  Search,
  ShoppingBag,
  Star,
  Users,
  Video,
} from "lucide-react";
import { useAuth } from "@ai-star-eco/api-client";
import { formatCredits } from "@ai-star-eco/api-client/format";
import {
  Avatar,
  Button,
  Sidebar,
  type NavGroup,
} from "@/components/creator";
import { CelebrityShellProvider, useCelebrityShell } from "@/lib/celebrity-shell-context";

// 侧栏入口都是顶层路径；选中判定：仅在该 tab 的「根 list 路径」高亮。
// 详情页（/star/<id>、/projects/<id>）不归属任何 list 父级，故均不高亮 —— 设计上
// 明星详情可由市场/我的两个 list 进入，归到任一都不对称，独立段最干净。
function buildGroups(pathname: string): NavGroup[] {
  const isExact = (href: string) => pathname === href;
  const isMixcut = pathname === "/mixcut" || pathname.startsWith("/mixcut/");
  return [
    {
      title: "工作台",
      items: [
        { icon: LayoutDashboard, label: "今日", href: "/dashboard", selected: isExact("/dashboard") },
        { icon: Star, label: "明星市场", href: "/market", selected: isExact("/market") },
        { icon: Users, label: "我的明星", href: "/cast", selected: isExact("/cast") },
      ],
    },
    {
      title: "制作",
      items: [
        { icon: Megaphone, label: "我的项目", href: "/projects", selected: isExact("/projects") },
        { icon: Video, label: "视频中心", href: "/library", selected: isExact("/library"), badge: 4 },
        { icon: ShoppingBag, label: "商品库", href: "/products", selected: isExact("/products") },
        { icon: Scissors, label: "混剪专区", href: "/mixcut", selected: isMixcut },
      ],
    },
    {
      title: "洞察",
      items: [
        { icon: BarChart3, label: "数据中心", href: "/data", selected: isExact("/data") },
      ],
    },
  ];
}

function CrumbsFromPathname(pathname: string): string[] {
  const TAB_LABEL: Record<string, string> = {
    "/dashboard": "今日",
    "/market": "明星市场",
    "/cast": "我的明星",
    "/projects": "我的项目",
    "/library": "视频中心",
    "/products": "商品库",
    "/data": "数据中心",
    "/mixcut": "混剪首页",
  };
  if (TAB_LABEL[pathname]) {
    return pathname === "/mixcut"
      ? ["工作台", "混剪专区", TAB_LABEL[pathname]]
      : ["工作台", "明星带货", TAB_LABEL[pathname]];
  }
  if (pathname.startsWith("/star")) return ["工作台", "明星市场", "明星详情"];
  if (pathname.startsWith("/projects/")) return ["工作台", "我的项目", "项目详情"];

  // 混剪专区子路径
  if (pathname === "/mixcut/templates") return ["工作台", "混剪专区", "模板库"];
  if (pathname.startsWith("/mixcut/templates/")) return ["工作台", "混剪专区", "模板库", "模板详情"];
  if (pathname.startsWith("/mixcut/create/")) return ["工作台", "混剪专区", "新建任务"];
  if (pathname === "/mixcut/jobs") return ["工作台", "混剪专区", "渲染任务"];
  if (pathname.startsWith("/mixcut/jobs/")) return ["工作台", "混剪专区", "渲染任务", "任务详情"];
  if (pathname === "/mixcut/library") return ["工作台", "混剪专区", "素材库"];

  return ["工作台"];
}

function TopbarRight() {
  const { wallet } = useCelebrityShell();
  const { user, logout } = useAuth();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        title="积分余额"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          background: "var(--accent-soft)",
          border: "1px solid color-mix(in srgb, var(--accent) 22%, transparent)",
          borderRadius: "var(--radius-pill)",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--accent-strong)",
          fontWeight: 600,
        }}
      >
        <Coins size={11} /> {wallet ? formatCredits(wallet.totalBalance) : "—"}
      </div>
      <Button variant="secondary" size="sm">
        导出
      </Button>
      <Button variant="accent" size="sm">
        <Plus size={12} />
        新建项目
      </Button>
      <Avatar seed={user?.username ?? user?.displayName ?? "anon"} size={32} />
      <Button variant="icon" size="sm" onClick={logout} title="退出登录" style={{ width: 32, padding: 0 }}>
        <LogOut size={12} />
      </Button>
    </div>
  );
}

function CustomTopbar({ crumbs }: { crumbs: string[] }) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        padding: "14px 28px",
        borderBottom: "1px solid var(--line)",
        gap: 16,
        background: "var(--bg-0)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--fg-2)",
          letterSpacing: 0.3,
        }}
      >
        {crumbs.map((c, i) => (
          <span key={i}>
            {c}
            {i < crumbs.length - 1 && <span style={{ color: "var(--fg-3)" }}> / </span>}
          </span>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <button
        type="button"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 14px",
          background: "var(--bg-1)",
          border: "1px solid var(--line-2)",
          borderRadius: "var(--radius-pill)",
          fontSize: 12.5,
          color: "var(--fg-2)",
          minWidth: 300,
          boxShadow: "var(--shadow-soft)",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          transition: "border-color 120ms ease, background 120ms ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line-2)";
        }}
      >
        <Search size={13} />
        <span>搜索明星、项目、视频…</span>
        <span
          className="mono"
          style={{
            marginLeft: "auto",
            padding: "1px 6px",
            border: "1px solid var(--line-2)",
            borderRadius: "var(--radius-sm)",
            fontSize: 10,
            color: "var(--fg-2)",
            background: "var(--bg-2)",
          }}
        >
          ⌘K
        </span>
      </button>
      <TopbarRight />
    </header>
  );
}

function TipOfDay() {
  return (
    <div
      style={{
        padding: "14px 16px",
        background: "var(--bg-2)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-md)",
        marginBottom: 12,
      }}
    >
      <div
        className="serif-italic"
        style={{
          fontSize: 15,
          color: "var(--fg-0)",
          marginBottom: 4,
          letterSpacing: -0.1,
        }}
      >
        今日小贴士
      </div>
      <div style={{ fontSize: 11.5, color: "var(--fg-2)", lineHeight: 1.5 }}>
        用<span className="mono" style={{ color: "var(--accent)" }}> ⌘K </span>
        快速搜索明星 / 项目；切片审核通过后自动进入分发队列。
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/dashboard";
  const { user } = useAuth();

  const groups = buildGroups(pathname);
  const crumbs = CrumbsFromPathname(pathname);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "220px 1fr",
        height: "100vh",
        background: "var(--bg-0)",
        color: "var(--fg-0)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <Sidebar
        brand={{ initials: "iP", name: "AI 明星带货", meta: "明星带货 · v0.5" }}
        groups={groups}
        footer={
          <>
            <TipOfDay />
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
                  {user?.studio?.name ?? "未绑定工作室"}
                </div>
              </div>
              <Link
                href="/"
                title="返回首页"
                style={{
                  color: "var(--fg-3)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                ↩
              </Link>
            </div>
          </>
        }
      />
      <main style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <CustomTopbar crumbs={crumbs} />
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "24px 28px 32px",
            background: "var(--bg-0)",
          }}
        >
          {children}
        </div>
      </main>
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
