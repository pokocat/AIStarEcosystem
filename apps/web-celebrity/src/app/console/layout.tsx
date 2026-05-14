"use client";

// /console/* shell —— 严格按参考图 Dashboard 实现。
// Sidebar 220px：紫色 iP mark + WORKSPACE 分组 + DRAMA 分组 + 底部"今日提示"小贴士
// Topbar：breadcrumb + 搜索 + Export + accent "+ New" + 圆头像

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  BarChart3,
  Calendar,
  Coins,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Plus,
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

function buildGroups(pathname: string, search: string): NavGroup[] {
  const tab = new URLSearchParams(search ?? "").get("tab") ?? "";
  const isHref = (href: string) => {
    const [p, q = ""] = href.split("?");
    const t = new URLSearchParams(q).get("tab") ?? "";
    return pathname === p && tab === t;
  };
  return [
    {
      title: "Workspace",
      items: [
        { icon: LayoutDashboard, label: "今日", href: "/console", selected: isHref("/console") },
        { icon: Star, label: "明星市场", href: "/console?tab=market", selected: isHref("/console?tab=market") },
      ],
    },
    {
      title: "Drama",
      items: [
        { icon: Users, label: "明星阵容", href: "/console?tab=cast", selected: isHref("/console?tab=cast") },
        {
          icon: Video,
          label: "切片队列",
          href: "/console?tab=library",
          selected: isHref("/console?tab=library"),
          badge: 4,
        },
        { icon: Megaphone, label: "项目流水线", href: "/console?tab=projects", selected: isHref("/console?tab=projects") },
        { icon: Boxes, label: "商品库", href: "/console?tab=products", selected: isHref("/console?tab=products") },
        { icon: BarChart3, label: "数据中心", href: "/console?tab=data", selected: isHref("/console?tab=data") },
      ],
    },
  ];
}

function CrumbsFromPathname(pathname: string, search: string): string[] {
  const tab = new URLSearchParams(search).get("tab") ?? "";
  const map: Record<string, string> = {
    "": "今日",
    market: "明星市场",
    cast: "明星阵容",
    library: "切片队列",
    projects: "项目流水线",
    products: "商品库",
    data: "数据中心",
  };
  if (pathname === "/console") return ["Studio", "明星带货", map[tab] ?? "今日"];
  if (pathname.startsWith("/console/star")) return ["Studio", "明星市场", "详情"];
  if (pathname.startsWith("/console/projects")) return ["Studio", "项目流水线", "详情"];
  return ["Studio"];
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
        Export
      </Button>
      <Button variant="accent" size="sm">
        <Plus size={12} />
        New scene
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 14px",
          background: "var(--bg-1)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-pill)",
          fontSize: 12.5,
          color: "var(--fg-2)",
          minWidth: 300,
          boxShadow: "var(--shadow-soft)",
        }}
      >
        <Search size={13} />
        <span>Search scenes, actors, series…</span>
        <span
          className="mono"
          style={{
            marginLeft: "auto",
            padding: "1px 6px",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-sm)",
            fontSize: 10,
            color: "var(--fg-3)",
          }}
        >
          ⌘K
        </span>
      </div>
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
        Tip of the day
      </div>
      <div style={{ fontSize: 11.5, color: "var(--fg-2)", lineHeight: 1.5 }}>
        用<span className="mono" style={{ color: "var(--accent)" }}> ⌘K </span>
        快速切换明星与剧集，节省 80% 鼠标点击。
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/console";
  const { user } = useAuth();
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    setSearch(window.location.search);
    const onPop = () => setSearch(window.location.search);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [pathname]);

  const groups = buildGroups(pathname, search);
  const crumbs = CrumbsFromPathname(pathname, search);

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
        brand={{ initials: "iP", name: "AI 明星带货", meta: "celebrity · v0.5" }}
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
                  {user?.studio?.name ?? "celebrity studio"}
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
