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
  Image as ImageIcon,
  Layers,
  LogOut,
  Menu,
  PenTool,
  Search,
  Settings,
  Share2,
  Shirt,
  Sliders,
  Sparkles,
  Users,
  Wallet as WalletIcon,
  Zap,
} from "lucide-react";
import { AccountApi, useAuth } from "@ai-star-eco/api-client";
import { PlatformAccessDenied } from "@ai-star-eco/landing";
import type { Wallet } from "@ai-star-eco/types/wallet";
import { RenderTaskDock } from "@/components/drama-workshop/render-task-dock";

interface NavSubItem {
  href: string;
  label: string;
}

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  /** 设为 true 时，仅在路径完全相等时高亮；否则前缀匹配也高亮（用于详情页继承父 tab）。 */
  exact?: boolean;
  /** 右侧小标签，如「建设中」。 */
  badge?: string;
  /** 父项激活时展开的二级入口（如创意市场 → 我发布的创意）。 */
  children?: NavSubItem[];
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

// v4 信息架构 — 设计真源 app-v4.jsx `NAV_V3`:创作 / 提效 / 素材;
// 既有的分发洞察与账户分组保留在下方。
const GROUPS: NavGroup[] = [
  {
    title: "创作",
    items: [
      { href: "/dashboard", icon: Sparkles, label: "首页", exact: true },
      { href: "/projects", icon: Film, label: "短剧工坊" },
      { href: "/shorts", icon: Zap, label: "短视频工坊" },
    ],
  },
  {
    // v0.63 补丁:剧本审阅收进「短剧工坊」页内入口,不再占一级菜单
    title: "提效",
    items: [
      // v0.75：模板库 → 创意市场（官方内置 + 用户发布统一在此）+ 子页「我发布的创意」
      { href: "/templates", icon: Layers, label: "创意市场", children: [{ href: "/templates/published", label: "我发布的创意" }] },
    ],
  },
  {
    title: "素材",
    items: [
      { href: "/assets", icon: ImageIcon, label: "素材库" },
      // v0.60 收敛：孵化 / 形象锻造入口下线，数字人统一在 AiAvatar 创建后引入
      { href: "/cast", icon: Users, label: "演员 IP 阵容" },
      { href: "/wardrobe", icon: Shirt, label: "戏服与道具", badge: "建设中" },
      { href: "/scripts", icon: PenTool, label: "脚本工坊", badge: "建设中" },
    ],
  },
  {
    title: "分发与洞察",
    items: [
      { href: "/distribution", icon: Share2, label: "多平台分发" },
      { href: "/insights", icon: BarChart3, label: "数据洞察" },
      { href: "/trends", icon: Compass, label: "趋势雷达", badge: "建设中" },
    ],
  },
  {
    title: "账户",
    items: [
      { href: "/wallet", icon: Coins, label: "积分钱包" },
      { href: "/finance", icon: WalletIcon, label: "财务中心" },
      { href: "/settings", icon: Settings, label: "工作室设置" },
      // 回收站不进侧栏：短剧工坊 / 短视频工坊页头各有「回收站」入口，避免一级菜单冗余。
    ],
  },
];

// 维护平台目录内容（热点 / 创意推荐等）。仅在 admin 后台授予运营身份（operatorRole）后自动显示。
const OPERATOR_GROUP: NavGroup = {
  title: "运营",
  items: [{ href: "/operations", icon: Sliders, label: "内容目录" }],
};

function isActive(pathname: string | null, item: NavItem): boolean {
  if (!pathname) return false;
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  // 运营入口完全由后端授予的运营身份（operatorRole）决定：admin 后台
  //（/celebrity/operators）配置 aep_users.operatorRole 后，/api/me 返回该字段，
  // 前端自动展示「运营 · 内容目录」入口。无前端开关，避免越权预览。
  const showOperator = !!user?.operatorRole;
  const groups = showOperator ? [...GROUPS, OPERATOR_GROUP] : GROUPS;
  return (
    <aside
      style={{
        background: "var(--bg-1)",
        borderRight: "1px solid var(--line)",
        padding: "14px 0",
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
          padding: "0 18px 12px",
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
            从灵感到成片
          </div>
        </div>
      </Link>

      <div style={{ padding: "10px 12px", flex: 1, overflowY: "auto", minHeight: 0 }}>
        {groups.map((g, gi) => (
          <div key={gi}>
            <div
              className="faint"
              style={{
                padding: gi === 0 ? "4px 12px 4px" : "12px 12px 4px",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: ".05em",
              }}
            >
              {g.title}
            </div>
            {g.items.map((it) => {
              const Icon = it.icon;
              const active = isActive(pathname, it);
              return (
                <React.Fragment key={it.href}>
                  <Link
                    href={it.href}
                    onClick={onNavigate}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "7px 12px",
                      borderRadius: 11,
                      background: active ? "var(--accent-soft)" : "transparent",
                      color: active ? "var(--accent)" : "var(--ink-2)",
                      fontSize: 13.5,
                      fontWeight: active ? 700 : 600,
                      marginBottom: 2,
                      transition: "background 160ms ease, color 160ms ease",
                      textDecoration: "none",
                    }}
                  >
                    <Icon
                      size={15}
                      color={active ? "var(--accent)" : "var(--ink-3)"}
                    />
                    <span style={{ flex: 1 }}>{it.label}</span>
                    {it.badge && (
                      <span
                        style={{
                          flex: "none",
                          fontSize: 9.5,
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: 999,
                          color: "#b45309",
                          background: "rgba(245,158,11,.16)",
                          letterSpacing: ".02em",
                        }}
                      >
                        {it.badge}
                      </span>
                    )}
                  </Link>
                  {it.children && active &&
                    it.children.map((c) => {
                      const cActive = pathname === c.href;
                      return (
                        <Link
                          key={c.href}
                          href={c.href}
                          onClick={onNavigate}
                          style={{
                            display: "block",
                            padding: "6px 12px 6px 39px",
                            borderRadius: 11,
                            color: cActive ? "var(--accent)" : "var(--ink-3)",
                            fontSize: 12.5,
                            fontWeight: cActive ? 700 : 500,
                            marginBottom: 2,
                            textDecoration: "none",
                            transition: "color 160ms ease",
                          }}
                        >
                          {c.label}
                        </Link>
                      );
                    })}
                </React.Fragment>
              );
            })}
          </div>
        ))}
      </div>

      {/* 后台生成任务面板（嵌入侧栏，仅在会触发渲染的页面有任务时显示；不再悬浮遮挡内容） */}
      <RenderTaskDock style={{ padding: "0 12px 8px", flexShrink: 0 }} />

      <div
        style={{
          padding: "10px 18px",
          borderTop: "1px solid var(--line)",
          flexShrink: 0,
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
        <span>搜索演员…</span>
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
              placeholder="输入演员名搜索…"
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

// 不在侧栏的路由（回收站 / 收银台 / 运营页 / 隐藏保留页）→ 标题兜底映射，
// 避免面包屑落空显示「工作台 / 工作台」。运营组 /operations 也在此补齐（sectionTitle 只扫 GROUPS）。
const FALLBACK_TITLES: { href: string; label: string }[] = [
  { href: "/operations", label: "内容目录" },
  { href: "/trash", label: "回收站" },
  { href: "/wallet/checkout", label: "收银台" },
  { href: "/review", label: "剧本审阅" },
  { href: "/forge", label: "形象锻造" },
  { href: "/incubator", label: "数字人孵化" },
  { href: "/short-drama", label: "短剧" },
];

/** 顶栏当前分区标题：按 pathname 匹配侧栏导航 + 非导航路由兜底（最长前缀），用于面包屑——
 *  修复短视频工坊等页面恒显「短剧工坊」的硬编码（/shorts → 短视频工坊 等），
 *  以及 /trash 等不在侧栏的路由落空显示「工作台」。返回 null 表示无匹配（面包屑只显示单级）。 */
function sectionTitle(pathname: string | null): string | null {
  if (!pathname) return null;
  const flat: { href: string; label: string; exact?: boolean }[] = [
    ...GROUPS.flatMap((g) =>
      g.items.flatMap((it) => [
        { href: it.href, label: it.label, exact: it.exact },
        ...((it.children ?? []).map((c) => ({ href: c.href, label: c.label }))),
      ]),
    ),
    ...FALLBACK_TITLES,
  ];
  let best: { href: string; label: string } | null = null;
  for (const it of flat) {
    const hit = it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(it.href + "/");
    if (hit && (!best || it.href.length > best.href.length)) best = it;
  }
  return best?.label ?? null;
}

function Topbar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const { logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
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
        // 透明顶栏 + 一条细线分隔，避免左栏 + 顶栏两块实色相邻显得厚重。
        borderBottom: "1px solid var(--line-soft)",
        background: "transparent",
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
        {(() => {
          const title = sectionTitle(pathname);
          // 命中分区 → 「分区 / 工作台」；未命中 → 仅显示单级「工作台」，不重复两个「工作台」。
          if (!title) return <span>工作台</span>;
          return (
            <>
              <span>{title}</span>
              <span className="ws-topbar-sub faint" style={{ fontWeight: 500 }}>
                / 工作台
              </span>
            </>
          );
        })()}
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
  // 注意:仅对「具体某部短剧」生效;保留字路由(new / trash)是常规列表页,必须走通用 shell
  // (否则回收站会脱离主站框架,既无侧栏也无顶栏)。
  const projectMatch = pathname?.match(/^\/projects\/([^/]+)(\/.*)?$/);
  const isWorkshop = !!projectMatch && !["new", "trash"].includes(projectMatch[1]);

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
