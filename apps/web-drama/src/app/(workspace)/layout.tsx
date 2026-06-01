"use client";

// 工作台 shell — 220px sidebar + topbar + main outlet。
// 路由组 (workspace) 不在 URL 出现；这里的子路由就是真实顶层路径：
//   /dashboard /cast /incubator /forge /wardrobe /scripts /projects ...
// 鉴权由 AppProviders 中 AuthProvider 处理（publicPathPrefixes = ["/","/login","/activate"]）。

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BarChart3,
  Clapperboard,
  Coins,
  Compass,
  Film,
  LayoutDashboard,
  LogOut,
  Menu,
  PenTool,
  Plus,
  Search,
  Settings,
  Share2,
  Shirt,
  Sparkles,
  Users,
  Wallet as WalletIcon,
  Wand2,
} from "lucide-react";
import { AccountApi, useAuth } from "@ai-star-eco/api-client";
import { PlatformAccessDenied } from "@ai-star-eco/landing";
import type { Wallet } from "@ai-star-eco/types/wallet";

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  /** 设为 true 时，仅在路径完全相等时高亮；否则前缀匹配也高亮（用于详情页继承父 tab）。 */
  exact?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    title: "工作台",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "总览", exact: true },
      { href: "/cast", icon: Users, label: "演员 IP 阵容" },
      { href: "/incubator", icon: Wand2, label: "孵化新演员" },
      { href: "/forge", icon: Sparkles, label: "形象锻造炉" },
      { href: "/wardrobe", icon: Shirt, label: "戏服与道具" },
      { href: "/scripts", icon: PenTool, label: "脚本工坊" },
      { href: "/short-drama", icon: Clapperboard, label: "短剧生成" },
      { href: "/projects", icon: Film, label: "项目流水线" },
    ],
  },
  {
    title: "分发与洞察",
    items: [
      { href: "/distribution", icon: Share2, label: "多平台分发" },
      { href: "/insights", icon: BarChart3, label: "数据洞察" },
      { href: "/trends", icon: Compass, label: "趋势雷达" },
    ],
  },
  {
    title: "系统",
    items: [
      { href: "/finance", icon: WalletIcon, label: "财务中心" },
      { href: "/settings", icon: Settings, label: "工作室设置" },
    ],
  },
];

function isActive(pathname: string | null, item: NavItem): boolean {
  if (!pathname) return false;
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
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
      <Link
        href="/projects"
        onClick={onNavigate}
        className="row gap-3"
        style={{
          padding: "0 18px 18px",
          borderBottom: "1px solid var(--line)",
          color: "var(--ink)",
          textDecoration: "none",
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 11,
            background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
            display: "grid",
            placeItems: "center",
            color: "#fff",
            boxShadow: "var(--shadow-sm)",
            flex: "none",
          }}
        >
          <Clapperboard size={16} strokeWidth={2.4} />
        </div>
        <div style={{ lineHeight: 1.2, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-.01em" }}>
            短剧工坊
          </div>
          <div className="faint" style={{ fontSize: 11, fontWeight: 500, marginTop: 2 }}>
            从灵感到成片配方
          </div>
        </div>
      </Link>

      <div style={{ padding: "16px 12px", flex: 1, overflowY: "auto" }}>
        {GROUPS.map((g, gi) => (
          <div key={gi}>
            <div
              className="eyebrow"
              style={{ padding: gi === 0 ? "8px 10px 8px" : "20px 10px 8px" }}
            >
              {g.title}
            </div>
            {g.items.map((it) => {
              const Icon = it.icon;
              const active = isActive(pathname, it);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={onNavigate}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "9px 10px",
                    borderRadius: "var(--radius-md)",
                    background: active
                      ? "color-mix(in srgb, var(--accent) 10%, transparent)"
                      : "transparent",
                    color: active ? "var(--fg-0)" : "var(--fg-1)",
                    fontSize: 13,
                    fontWeight: active ? 500 : 400,
                    marginBottom: 2,
                    border: active
                      ? "1px solid color-mix(in srgb, var(--accent) 25%, transparent)"
                      : "1px solid transparent",
                    transition: "background 160ms ease, border-color 160ms ease",
                    textDecoration: "none",
                  }}
                >
                  <Icon size={15} color={active ? "var(--accent)" : "var(--fg-2)"} />
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

function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 简易：当前只把 q 同步到 URL，对应页内自己读 ?q=
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    // 跳到 cast 列表，q 作为筛选关键字
    router.push(`/cast?q=${encodeURIComponent(q.trim())}`);
    setOpen(false);
    setQ("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="搜索"
        className="row gap-2"
        style={{
          padding: "0 14px",
          height: 36,
          background: "var(--surface-2)",
          border: "1px solid transparent",
          borderRadius: 999,
          fontSize: 12.5,
          color: "var(--ink-3)",
          minWidth: 280,
          cursor: "pointer",
          transition: "border-color .15s, background .15s",
        }}
      >
        <Search size={14} />
        <span>搜索剧集、演员、脚本…</span>
      </button>
      {open && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="card pop-in row gap-3"
            style={{
              width: "min(560px, 90vw)",
              padding: "10px 16px",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <Search size={18} color="var(--ink-3)" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="按演员 / 剧名 / 脚本搜索…"
              style={{
                flex: 1,
                padding: "12px 4px",
                background: "transparent",
                border: "none",
                color: "var(--ink)",
                fontSize: 14,
                outline: "none",
                fontFamily: "var(--font)",
              }}
            />
            <kbd
              style={{
                fontSize: 10,
                padding: "2px 6px",
                border: "1px solid var(--line-2)",
                borderRadius: 4,
                color: "var(--fg-3)",
              }}
            >
              Enter
            </kbd>
          </form>
        </div>
      )}
    </>
  );
}

function Topbar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const { logout } = useAuth();
  const router = useRouter();
  const [wallet, setWallet] = React.useState<Wallet | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    AccountApi.getMyWallet()
      .then((w) => {
        if (!cancelled) setWallet(w);
      })
      .catch(() => {
        /* 静默 */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleLogout() {
    logout();
    toast.success("已退出登录");
  }

  return (
    <header
      className="ws-topbar"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "14px 28px",
        borderBottom: "1px solid var(--line)",
        background: "color-mix(in oklch, var(--bg) 86%, transparent)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <button
        type="button"
        onClick={onMenuToggle}
        className="ws-hamburger btn btn-icon btn-ghost btn-sm"
        title="打开菜单"
        aria-label="打开菜单"
      >
        <Menu size={16} />
      </button>
      <div className="row gap-2" style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>
        <span>短剧工坊</span>
        <span className="ws-topbar-sub faint" style={{ fontWeight: 500 }}>
          / 工作台
        </span>
      </div>
      <div className="grow" />
      <div className="ws-topbar-search">
        <GlobalSearch />
      </div>

      <button
        type="button"
        onClick={() => router.push("/finance")}
        title="积分余额 · 点击进入财务"
        className="row gap-2"
        style={{
          padding: "6px 14px",
          background: "var(--accent-soft)",
          border: "none",
          borderRadius: 999,
          cursor: "pointer",
          color: "var(--accent)",
        }}
      >
        <Coins size={13} />
        <span className="num" style={{ fontSize: 13, fontWeight: 700 }}>
          {wallet ? wallet.totalBalance.toLocaleString("zh-CN") : "—"}
        </span>
      </button>

      <button
        type="button"
        onClick={() => router.push("/projects?new=1")}
        title="新建短剧项目"
        className="btn btn-grad btn-sm"
      >
        <Plus size={14} />
        <span className="ws-btn-label">新建短剧</span>
      </button>

      <button
        type="button"
        onClick={handleLogout}
        title="退出登录"
        className="btn btn-icon btn-ghost btn-sm"
      >
        <LogOut size={14} />
      </button>
    </header>
  );
}

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { user, hasPlatformAccess } = useAuth();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const pathname = usePathname();
  // 短剧工作台沉浸态:进入某部短剧后(`/projects/<id>`)自带 6 阶段轨 + 顶部
  // 项目条 + 角色面板,不挂通用 workspace sidebar/topbar。
  const isWorkshop = !!pathname?.match(/^\/projects\/[^/]+(\/.*)?$/) && !pathname.startsWith("/projects/new");

  // 抽屉打开时锁定背景滚动（移动端体验）。
  React.useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  // v0.43+：平台访问隔离 —— 已登录但账号未开通「AI 短剧」时拦截（未登录由 AuthProvider 跳登录）。
  if (user && !hasPlatformAccess) {
    return (
      <PlatformAccessDenied
        appName="AI 短剧"
        theme={{
          bg: "var(--bg)",
          surface: "var(--surface)",
          fg: "var(--ink)",
          fgMuted: "var(--ink-2)",
          accent: "var(--accent)",
          accentFg: "#fff",
          border: "var(--line)",
          radius: "var(--radius)",
        }}
      />
    );
  }

  // 工作台沉浸态:跳过通用 sidebar/topbar,把整屏交给 page.tsx
  if (isWorkshop) {
    return (
      <div className="ws-shell" style={{ display: "block", gridTemplateColumns: "none", overflow: "hidden" }}>
        {children}
      </div>
    );
  }

  return (
    <div className="ws-shell">
      <div className="ws-sidebar-wrap">
        <Sidebar />
      </div>
      <main
        style={{
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
          minWidth: 0,
          background: "var(--bg)",
        }}
      >
        <Topbar onMenuToggle={() => setDrawerOpen(true)} />
        <div className="ws-content">{children}</div>
      </main>

      {/* 移动端抽屉导航 */}
      {drawerOpen ? (
        <div className="ws-drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <div
            className="ws-drawer"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
