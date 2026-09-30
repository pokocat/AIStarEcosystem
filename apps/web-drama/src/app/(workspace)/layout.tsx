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
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "@ai-star-eco/api-client";
import { EnrollmentGate } from "@ai-star-eco/landing";
import { RenderTaskDock, RenderTaskTopbarEntry } from "@/components/drama-workshop/render-task-dock";
import { useWallet } from "@/lib/use-wallet";
import { useModalA11y } from "@/lib/use-modal-a11y";

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
  /** 常驻的二级入口（如模板广场 → 我发布的模板）。 */
  children?: NavSubItem[];
}

interface NavGroup {
  title: string;
  items: NavItem[];
  /** 「即将上线」分组：颜色淡一点，提示这些功能还不完整（页面顶部各有如实说明）。 */
  soon?: boolean;
}

// v0.197 侧栏（docs/drama-ux-copy-pass.md §3.1）：
//   「短剧工坊」只作品牌（Logo），不再当菜单名；没做完的功能统一收进最底下「即将上线」，
//   不再在主菜单里挂「建设中」胶囊。
const GROUPS: NavGroup[] = [
  {
    title: "创作",
    items: [
      { href: "/dashboard", icon: Sparkles, label: "首页", exact: true },
      { href: "/projects", icon: Film, label: "我的短剧" },
      { href: "/shorts", icon: Zap, label: "我的短视频" },
      // v0.198：画布（剧本 → 角色和场景 → 逐集制作，独立于「我的短剧」）。/canvas/<id> 是沉浸态，见下面 isCanvas。
      { href: "/canvas", icon: Workflow, label: "画布" },
      { href: "/templates", icon: Layers, label: "模板广场", children: [{ href: "/templates/published", label: "我发布的模板" }] },
    ],
  },
  {
    title: "素材",
    items: [
      { href: "/assets", icon: ImageIcon, label: "素材库" },
      // v0.60 收敛：孵化 / 形象锻造入口下线，数字人统一在 AiAvatar 创建后引入
      { href: "/cast", icon: Users, label: "数字人演员" },
    ],
  },
  {
    title: "账户",
    items: [
      { href: "/wallet", icon: Coins, label: "积分钱包" },
      { href: "/finance", icon: WalletIcon, label: "收入与提现" },
      { href: "/settings", icon: Settings, label: "工作室设置" },
      // 回收站不进侧栏：我的短剧 / 我的短视频页头各有「回收站」入口。
    ],
  },
];

// 维护首页热点与推荐点子。仅在 admin 后台授予运营身份（operatorRole）后显示。
const OPERATOR_GROUP: NavGroup = {
  title: "运营",
  items: [{ href: "/operations", icon: Sliders, label: "热点与推荐" }],
};

// 还没做完的功能：路由保留、页面顶部如实说明哪部分还是假的。
const SOON_GROUP: NavGroup = {
  title: "即将上线",
  soon: true,
  items: [
    { href: "/distribution", icon: Share2, label: "多平台发布" },
    { href: "/insights", icon: BarChart3, label: "数据分析" },
    { href: "/trends", icon: Compass, label: "趋势雷达" },
    { href: "/scripts", icon: PenTool, label: "脚本库" },
    { href: "/wardrobe", icon: Shirt, label: "戏服与道具" },
  ],
};

function navGroups(showOperator: boolean): NavGroup[] {
  return showOperator ? [...GROUPS, OPERATOR_GROUP, SOON_GROUP] : [...GROUPS, SOON_GROUP];
}

function isActive(pathname: string | null, item: NavItem): boolean {
  if (!pathname) return false;
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

function Sidebar({ onNavigate, onClose }: { onNavigate?: () => void; onClose?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  // 运营入口完全由后端授予的运营身份（operatorRole）决定：admin 后台
  //（/celebrity/operators）配置 aep_users.operatorRole 后，/api/me 返回该字段，
  // 前端自动展示「运营 · 热点与推荐」入口。无前端开关，避免越权预览。
  const groups = navGroups(!!user?.operatorRole);
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
      <div className="row" style={{ padding: "0 12px 12px 18px", borderBottom: "1px solid var(--line)", gap: 8 }}>
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="row gap-3"
          style={{ color: "var(--ink)", textDecoration: "none", flex: 1, minWidth: 0 }}
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
            <div className="faint" style={{ fontSize: 11, fontWeight: 500, marginTop: 2, whiteSpace: "nowrap" }}>
              AI 做短剧和短视频
            </div>
          </div>
        </Link>
        {onClose && (
          <button type="button" className="btn btn-icon btn-ghost btn-sm" onClick={onClose} aria-label="关闭菜单" title="关闭菜单">
            <X size={15} />
          </button>
        )}
      </div>

      <nav aria-label="主菜单" style={{ padding: "10px 12px", flex: 1, overflowY: "auto", minHeight: 0 }}>
        {groups.map((g, gi) => (
          <div key={g.title}>
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
              const idle = g.soon ? "var(--ink-3)" : "var(--ink-2)";
              return (
                <React.Fragment key={it.href}>
                  <Link
                    href={it.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: g.soon ? "6px 12px" : "7px 12px",
                      borderRadius: 11,
                      background: active ? "var(--accent-soft)" : "transparent",
                      color: active ? "var(--accent)" : idle,
                      fontSize: g.soon ? 13 : 13.5,
                      fontWeight: active ? 700 : g.soon ? 500 : 600,
                      marginBottom: 2,
                      transition: "background 160ms ease, color 160ms ease",
                      textDecoration: "none",
                    }}
                  >
                    <Icon
                      size={15}
                      color={active ? "var(--accent)" : "var(--ink-3)"}
                      style={{ flex: "none", opacity: g.soon && !active ? 0.75 : 1 }}
                    />
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {it.label}
                    </span>
                  </Link>
                  {it.children?.map((c) => {
                    const cActive = pathname === c.href || !!pathname?.startsWith(c.href + "/");
                    return (
                      <Link
                        key={c.href}
                        href={c.href}
                        onClick={onNavigate}
                        aria-current={cActive ? "page" : undefined}
                        style={{
                          display: "block",
                          padding: "5px 12px 5px 39px",
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
      </nav>

      {/* 后台生成任务面板（嵌入侧栏，仅在会触发生成的页面有任务时显示；不再悬浮遮挡内容） */}
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
            flex: "none",
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
            title={user?.displayName ?? undefined}
          >
            {user?.displayName ?? "未登录"}
          </div>
          <div
            style={{
              fontSize: 10.5,
              color: "var(--fg-2)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {user?.studio?.name ?? "我的工作室"}
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
  const panelRef = React.useRef<HTMLFormElement | null>(null);
  const close = React.useCallback(() => setOpen(false), []);
  useModalA11y(panelRef, close, open);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 目前只能搜数字人演员：跳到 /cast?q=，演员页自己读 q 做筛选
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    router.push(`/cast?q=${encodeURIComponent(q.trim())}`);
    setOpen(false);
    setQ("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="搜索数字人演员（⌘K）"
        className="ws-topbar-search row gap-2"
        style={{
          padding: "0 14px",
          height: 36,
          background: "var(--surface-2)",
          border: "1px solid transparent",
          borderRadius: 999,
          fontSize: 12.5,
          color: "var(--ink-3)",
          width: "clamp(180px, 22vw, 260px)",
          minWidth: 0,
          flex: "none",
          cursor: "pointer",
          transition: "border-color .15s, background .15s",
        }}
      >
        <Search size={14} style={{ flex: "none" }} />
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>
          搜索数字人演员
        </span>
        <kbd style={{ fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--font)", flex: "none" }}>⌘K</kbd>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="搜索数字人演员"
        aria-label="搜索数字人演员"
        className="ws-topbar-search-icon btn btn-icon btn-ghost btn-sm"
      >
        <Search size={15} />
      </button>
      {open && (
        <div className="overlay" onClick={() => setOpen(false)} style={{ alignItems: "start", paddingTop: "12vh" }}>
          <form
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="搜索数字人演员"
            tabIndex={-1}
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="card pop-in row gap-3"
            style={{
              width: 560,
              maxWidth: "100%",
              padding: "10px 16px",
              boxShadow: "var(--shadow-lg)",
              outline: "none",
            }}
          >
            <Search size={18} color="var(--ink-3)" style={{ flex: "none" }} />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="输入数字人名字，按回车搜索"
              enterKeyHint="search"
              style={{
                flex: 1,
                minWidth: 0,
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
              className="ws-btn-label"
              style={{
                fontSize: 10,
                padding: "2px 6px",
                border: "1px solid var(--line-2)",
                borderRadius: 4,
                color: "var(--fg-3)",
                flex: "none",
              }}
            >
              回车
            </kbd>
          </form>
        </div>
      )}
    </>
  );
}

// 不在侧栏的路由（新建 / 制作页 / 回收站 / 收银台 / 隐藏保留页）→ 面包屑标题兜底。
// 命中这里且上一级在侧栏里时，面包屑显示「上一级 / 这一页」（如「我的短视频 / 粘贴写好的脚本」）。
const FALLBACK_TITLES: { href: string; label: string }[] = [
  { href: "/projects/new", label: "新建短剧" },
  { href: "/projects/trash", label: "回收站" },
  { href: "/shorts/new", label: "从一句话开始" },
  { href: "/shorts/prompt", label: "粘贴写好的脚本" },
  { href: "/shorts/make", label: "制作短视频" },
  { href: "/canvas/new", label: "新建画布" },
  { href: "/trash", label: "回收站" },
  { href: "/wallet/checkout", label: "收银台" },
  { href: "/review", label: "剧本审阅" },
  { href: "/forge", label: "新建数字人" },
  { href: "/incubator", label: "新建数字人" },
  { href: "/short-drama", label: "我的短剧" },
];

interface Crumb {
  href: string;
  label: string;
}

function matches(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
}

/** 顶栏面包屑：最长前缀命中的那一页；它若是某个侧栏项的下一级，前面再带上那一项。
 *  没命中返回空数组（顶栏只显示品牌名）。 */
function breadcrumb(pathname: string | null): Crumb[] {
  if (!pathname) return [];
  const top: { href: string; label: string; exact?: boolean }[] = navGroups(true).flatMap((g) =>
    g.items.map((it) => ({ href: it.href, label: it.label, exact: it.exact })),
  );
  const sub: Crumb[] = [
    ...navGroups(true).flatMap((g) => g.items.flatMap((it) => it.children ?? [])),
    ...FALLBACK_TITLES,
  ];
  let parent: Crumb | null = null;
  for (const it of top) {
    if (matches(pathname, it.href, it.exact) && (!parent || it.href.length > parent.href.length)) parent = it;
  }
  let leaf: Crumb | null = null;
  for (const it of sub) {
    if (matches(pathname, it.href) && (!leaf || it.href.length > leaf.href.length)) leaf = it;
  }
  if (leaf && (!parent || leaf.href.length > parent.href.length)) {
    return parent && leaf.label !== parent.label ? [parent, leaf] : [leaf];
  }
  return parent ? [parent] : [];
}

function Topbar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const { logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { wallet } = useWallet();
  const crumbs = breadcrumb(pathname);

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
        minWidth: 0,
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
      <nav aria-label="当前位置" className="ws-topbar-crumb">
        {crumbs.length === 0 ? (
          <span>短剧工坊</span>
        ) : crumbs.length === 1 ? (
          <span title={crumbs[0].label}>{crumbs[0].label}</span>
        ) : (
          <>
            <Link href={crumbs[0].href} className="ws-topbar-sub faint" style={{ fontWeight: 500 }}>
              {crumbs[0].label}
            </Link>
            <span className="ws-topbar-sub faint" aria-hidden style={{ fontWeight: 500, flex: "none" }}>
              /
            </span>
            <span title={crumbs[1].label}>{crumbs[1].label}</span>
          </>
        )}
      </nav>
      <div className="grow" />
      <GlobalSearch />
      <span className="ws-topbar-tasks">
        <RenderTaskTopbarEntry />
      </span>

      <button
        type="button"
        onClick={() => router.push("/wallet")}
        title="积分余额，点开可充值、看明细"
        aria-label={wallet ? `积分余额 ${wallet.totalBalance}，点开可充值、看明细` : "积分余额，点开可充值、看明细"}
        className="ws-topbar-balance row gap-2"
        style={{
          padding: "6px 14px",
          height: 32,
          background: "var(--accent-soft)",
          border: "none",
          borderRadius: 999,
          cursor: "pointer",
          color: "var(--accent)",
        }}
      >
        <Coins size={13} style={{ flex: "none" }} />
        <span className="num" style={{ fontSize: 13, fontWeight: 700 }}>
          {wallet ? wallet.totalBalance.toLocaleString("zh-CN") : "—"}
        </span>
      </button>

      <button
        type="button"
        onClick={handleLogout}
        title="退出登录"
        aria-label="退出登录"
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
  const drawerRef = React.useRef<HTMLDivElement | null>(null);
  const closeDrawer = React.useCallback(() => setDrawerOpen(false), []);
  // 抽屉：ESC 关闭、焦点圈在抽屉里、背景不滚（共享 hook，与各弹窗同一套）
  useModalA11y(drawerRef, closeDrawer, drawerOpen);
  // 短剧工作台沉浸态：进入某部短剧（`/projects/<id>`）后自带阶段轨 + 顶部条 + 角色面板，
  // 不挂通用 sidebar/topbar。只匹配这一层：
  //   · 保留字 new / trash 是常规列表页；
  //   · 子路由（如 /projects/<id>/distribute）是普通页面，要侧栏和顶栏（v0.197，之前被当成工作台，
  //     既没侧栏也没顶栏，内容贴着屏幕左边）。
  const projectMatch = pathname?.match(/^\/projects\/([^/]+)\/?$/);
  const isWorkshop = !!projectMatch && !["new", "trash"].includes(projectMatch[1]);
  // v0.198：画布沉浸态 —— 进到一张画布（`/canvas/<id>` 及其子路由）后换成画布自己的竖条 + 顶栏，
  // 不挂通用侧栏 / 顶栏。列表 `/canvas` 与新建 `/canvas/new` 走通用外壳。
  const canvasMatch = pathname?.match(/^\/canvas\/([^/]+)(?:\/.*)?$/);
  const isCanvas = !!canvasMatch && canvasMatch[1] !== "new";

  // 换页时收起抽屉
  React.useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // v0.149+：开通门 —— 已登录但账号未开通短剧时渲染开通页
  //（未登录由 AuthProvider 跳登录 / 账号中心）。
  if (user && !hasPlatformAccess) {
    return (
      <EnrollmentGate
        product="drama"
        productLabel="短剧工坊"
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

  // 工作台 / 画布沉浸态：跳过通用 sidebar/topbar，把整屏交给 page.tsx（画布交给 canvas/[canvasId]/layout.tsx）
  if (isWorkshop || isCanvas) {
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
        <div className="ws-drawer-overlay" onClick={closeDrawer}>
          <div
            ref={drawerRef}
            className="ws-drawer"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="菜单"
            tabIndex={-1}
            style={{ outline: "none" }}
          >
            <Sidebar onNavigate={closeDrawer} onClose={closeDrawer} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
