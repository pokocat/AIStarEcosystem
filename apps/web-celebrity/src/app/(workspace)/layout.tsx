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
  Flame,
  FlaskConical,
  Images,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Scissors,
  ScrollText,
  Search,
  Send,
  Settings,
  ShoppingBag,
  Sparkles,
  Star,
  Video,
  Workflow,
} from "lucide-react";
import { useAuth, PublishJobApi } from "@ai-star-eco/api-client";
import { formatCredits } from "@ai-star-eco/api-client/format";
import { PlatformAccessDenied } from "@ai-star-eco/landing";
import { useIsMobile } from "@ai-star-eco/ui/ui/use-mobile";
import {
  Avatar,
  Button,
  MobileShell,
  Sidebar,
  type NavGroup,
  type NavSubItem,
} from "@/components/creator";
import { CelebrityShellProvider, useCelebrityShell } from "@/lib/celebrity-shell-context";
import { MixcutApi } from "@/api";

// 侧栏入口都是顶层路径；选中判定：仅在该 tab 的「根 list 路径」高亮。
// 详情页（/star/<id>、/projects/<id>）不归属任何 list 父级，故均不高亮 —— 设计上
// 明星详情可由市场/我的两个 list 进入，归到任一都不对称，独立段最干净。
function buildGroups(pathname: string, activeJobs: number, inflightPublishJobs: number): NavGroup[] {
  const isExact = (href: string) => pathname === href;
  const isMixcut = pathname === "/mixcut" || pathname.startsWith("/mixcut/");
  const isDistribution = pathname === "/distribution" || pathname.startsWith("/distribution/");
  const isWorkshop = pathname === "/material/workshop" || pathname.startsWith("/material/workshop/");

  // 混剪二级菜单:仅在用户处于 /mixcut/* 时展开,避免常态污染侧栏。
  // 创建任务页 (/mixcut/create/<id>) 不高亮任一子项 —— 它是一次性流程,不属于任何长存的子区。
  // v0.16: 「发布工作台」迁入分发中心，从混剪侧栏移除；混剪只负责制作。
  const mixcutChildren: NavSubItem[] | undefined = isMixcut
    ? [
      { label: "工作台", href: "/mixcut", selected: pathname === "/mixcut" },
      {
        label: "模板库",
        href: "/mixcut/templates",
        selected: pathname === "/mixcut/templates" || pathname.startsWith("/mixcut/templates/"),
      },
      {
        // v0.48+: 草稿箱（实例）—— 模版 → 实例 → 生成任务 中间层
        label: "草稿箱",
        href: "/mixcut/drafts",
        selected: pathname === "/mixcut/drafts",
      },
      {
        label: "生成任务",
        href: "/mixcut/jobs",
        selected: pathname === "/mixcut/jobs" || pathname.startsWith("/mixcut/jobs/"),
        badge: activeJobs > 0 ? activeJobs : undefined,
        badgeTone: "accent",
      },
      { label: "素材库", href: "/mixcut/library", selected: pathname === "/mixcut/library" },
    ]
    : undefined;

  // 分发中心二级菜单：仅在用户处于 /distribution/* 时展开。
  // v0.18: 路由化为 /distribution（工作台）/ /distribution/accounts / /distribution/jobs；不再用 tabs。
  const distributionChildren: NavSubItem[] | undefined = isDistribution
    ? [
      { label: "分发工作台", href: "/distribution", selected: pathname === "/distribution" },
      {
        label: "账号管理",
        href: "/distribution/accounts",
        selected: pathname === "/distribution/accounts",
      },
      {
        label: "任务追踪",
        href: "/distribution/jobs",
        selected: pathname === "/distribution/jobs",
        badge: inflightPublishJobs > 0 ? inflightPublishJobs : undefined,
        badgeTone: "accent",
      },
    ]
    : undefined;

  return [
    {
      title: "工作台",
      items: [
        { icon: LayoutDashboard, label: "今日", href: "/dashboard", selected: isExact("/dashboard") },
        // v0.37+：合并「我的明星」/cast 入「明星市场」/market —— 同页面顶部就是「我的授权明星」section，
        // 数据源也对齐 admin DB（v0.34+ /api/celebrity/stars）。
        { icon: Star, label: "明星市场", href: "/market", selected: isExact("/market") },
        // v0.37+：「快速生成」入口外放 —— 直接列已授权明星 → /star/{id}/generate
        { icon: Sparkles, label: "快速生成", href: "/generate", selected: isExact("/generate") },
      ],
    },
    {
      title: "制作",
      items: [
        { icon: Megaphone, label: "我的项目", href: "/projects", selected: isExact("/projects") },
        // v0.44+：「视频库」聚合三类成片（明星视频 / 脚本视频 / 混剪成片），只读浏览。
        { icon: Video, label: "视频库", href: "/library", selected: isExact("/library") },
        { icon: ShoppingBag, label: "商品库", href: "/products", selected: isExact("/products") },
        {
          icon: Scissors,
          label: "混剪专区",
          href: "/mixcut",
          selected: isMixcut,
          children: mixcutChildren,
        },
        {
          icon: Send,
          label: "分发中心",
          href: "/distribution",
          selected: isDistribution,
          children: distributionChildren,
        },
      ],
    },
    {
      // 素材运营：脚本工坊 → 商品素材库 → 爆款雷达 → 智能体训练 → 效果回流。
      // 迁自「素材运营平台」原型；纯前端 + Mock。
      title: "素材运营",
      items: [
        { icon: ScrollText, label: "脚本工坊", href: "/material/workshop", selected: isWorkshop },
        { icon: Images, label: "商品素材库", href: "/material/assets", selected: isExact("/material/assets") },
        { icon: Flame, label: "爆款雷达", href: "/material/radar", selected: isExact("/material/radar") },
        { icon: FlaskConical, label: "智能体训练", href: "/material/agent", selected: isExact("/material/agent") },
        { icon: Workflow, label: "效果回流", href: "/material/loop", selected: isExact("/material/loop") },
      ],
    },
    {
      title: "洞察",
      items: [
        { icon: BarChart3, label: "数据中心", href: "/data", selected: isExact("/data") },
        { icon: Coins, label: "积分钱包", href: "/wallet", selected: pathname === "/wallet" || pathname.startsWith("/wallet/") },
        { icon: Settings, label: "账户设置", href: "/account", selected: isExact("/account") },
      ],
    },
  ];
}

function CrumbsFromPathname(pathname: string): string[] {
  const TAB_LABEL: Record<string, string> = {
    "/dashboard": "今日",
    "/market": "明星市场",
    "/generate": "快速生成",
    "/projects": "我的项目",
    "/library": "视频库",
    "/products": "商品库",
    "/data": "数据中心",
    "/mixcut": "混剪工作台",
    "/wallet": "积分钱包",
    "/account": "账户设置",
  };
  // /distribution 默认 = 分发工作台，单独分支以保证子菜单层级正确
  if (pathname === "/distribution") return ["工作台", "分发中心", "分发工作台"];
  if (TAB_LABEL[pathname]) {
    return pathname === "/mixcut"
      ? ["工作台", "混剪专区", TAB_LABEL[pathname]]
      : ["工作台", "明星带货", TAB_LABEL[pathname]];
  }
  if (pathname.startsWith("/star")) return ["工作台", "明星市场", "明星详情"];
  if (pathname.startsWith("/projects/")) return ["工作台", "我的项目", "项目详情"];
  if (pathname.startsWith("/products/")) return ["工作台", "明星带货", "商品库", "商品详情"];

  // 混剪专区子路径
  if (pathname === "/mixcut/templates") return ["工作台", "混剪专区", "模板库"];
  if (pathname.startsWith("/mixcut/templates/")) return ["工作台", "混剪专区", "模板库", "模板详情"];
  if (pathname === "/mixcut/drafts") return ["工作台", "混剪专区", "草稿箱"];
  if (pathname.startsWith("/mixcut/create/")) return ["工作台", "混剪专区", "新建任务"];
  if (pathname === "/mixcut/jobs") return ["工作台", "混剪专区", "生成任务"];
  if (pathname.startsWith("/mixcut/jobs/")) return ["工作台", "混剪专区", "生成任务", "任务详情"];
  if (pathname === "/mixcut/library") return ["工作台", "混剪专区", "素材库"];

  // 分发中心子路径（v0.18 路由化）
  if (pathname === "/distribution/accounts") return ["工作台", "分发中心", "账号管理"];
  if (pathname === "/distribution/jobs") return ["工作台", "分发中心", "任务追踪"];
  if (pathname.startsWith("/distribution/")) return ["工作台", "分发中心"];

  // 素材运营
  if (pathname === "/material/workshop") return ["素材运营", "脚本工坊"];
  if (pathname.endsWith("/edit")) return ["素材运营", "脚本工坊", "编辑脚本"];
  if (pathname.startsWith("/material/workshop/")) return ["素材运营", "脚本工坊", "脚本预览"];
  if (pathname === "/material/assets") return ["素材运营", "商品素材库"];
  if (pathname === "/material/radar") return ["素材运营", "爆款雷达"];
  if (pathname === "/material/agent") return ["素材运营", "智能体训练"];
  if (pathname === "/material/loop") return ["素材运营", "效果回流"];

  return ["工作台"];
}

function TopbarRight() {
  const { wallet } = useCelebrityShell();
  const { user, logout } = useAuth();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Link
        href="/wallet"
        title="积分钱包，点击查看明细或充值"
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
          textDecoration: "none",
          transition: "background 0.15s",
        }}
      >
        <Coins size={11} /> {wallet ? formatCredits(wallet.totalBalance) : "—"}
        {wallet && wallet.pendingBalance > 0 && (
          <span
            title={`${formatCredits(wallet.pendingBalance)} 积分已锁定（生成中的任务）`}
            style={{
              fontSize: 10,
              padding: "1px 5px",
              borderRadius: 4,
              background: "color-mix(in srgb, var(--accent) 18%, transparent)",
              fontWeight: 500,
            }}
          >
            锁定 {formatCredits(wallet.pendingBalance)}
          </span>
        )}
      </Link>
      <Avatar seed={user?.username ?? user?.displayName ?? "anon"} size={32} />
      <Button variant="icon" size="sm" onClick={logout} title="退出当前账号" style={{ width: 32, padding: 0 }}>
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
        快速搜索明星和项目；视频审核通过后会自动进入分发流程。
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/dashboard";
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const isMixcut = pathname === "/mixcut" || pathname.startsWith("/mixcut/");
  const isDistribution =
    pathname === "/distribution" || pathname.startsWith("/distribution/");
  const [activeJobs, setActiveJobs] = React.useState(0);
  const [inflightPublishJobs, setInflightPublishJobs] = React.useState(0);

  // 「生成任务」子项上的活跃数 badge。
  // 仅在用户处于 /mixcut/* 时拉,避免在其他子产品页面无谓请求。
  // 进入混剪时立即拉一次,有活跃任务时每 4s 轻量轮询。
  React.useEffect(() => {
    if (!isMixcut) {
      setActiveJobs(0);
      return;
    }
    let cancelled = false;
    const tick = () => {
      MixcutApi.listJobs()
        .then((jobs) => {
          if (cancelled) return;
          setActiveJobs(
            jobs.filter((j) => j.status === "running" || j.status === "queued" || j.status === "pending").length,
          );
        })
        .catch(() => {
          /* 网络抖动忽略,下次再试 */
        });
    };
    tick();
    const timer = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isMixcut, pathname]);

  // 「任务追踪」子项 badge：分发中心 inflight 数。仅在 /distribution/* 拉。
  React.useEffect(() => {
    if (!isDistribution) {
      setInflightPublishJobs(0);
      return;
    }
    let cancelled = false;
    const tick = () => {
      PublishJobApi.listPublishJobs({})
        .then((list) => {
          if (cancelled) return;
          setInflightPublishJobs(
            list.filter(
              (j) =>
                j.status !== "live" && j.status !== "failed" && j.status !== "cancelled",
            ).length,
          );
        })
        .catch(() => {
          /* 静默 */
        });
    };
    tick();
    const timer = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isDistribution, pathname]);

  const groups = buildGroups(pathname, activeJobs, inflightPublishJobs);
  const crumbs = CrumbsFromPathname(pathname);

  // 窄屏（<768px）走移动 shell：底部 Tab Bar + 抽屉导航，复用同一份 groups。
  if (isMobile) {
    const title = crumbs[crumbs.length - 1] ?? "AI 明星带货";
    return (
      <MobileShell groups={groups} title={title}>
        {children}
      </MobileShell>
    );
  }

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
        brand={{ initials: "iP", name: "AI 明星带货", meta: "明星带货 · v0.5", logoSrc: "/icon.svg" }}
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
                  {user?.studio?.name ?? "还未绑定工作室"}
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
  const { user, hasPlatformAccess } = useAuth();

  // v0.43+：平台访问隔离 —— 已登录但账号未开通「AI 明星带货」时拦截（未登录由 AuthProvider 跳登录）。
  if (user && !hasPlatformAccess) {
    return (
      <PlatformAccessDenied
        appName="AI 明星带货"
        theme={{
          bg: "var(--bg-0)",
          surface: "#ffffff",
          fg: "var(--fg-0)",
          fgMuted: "var(--fg-2)",
          accent: "var(--accent)",
          accentFg: "#ffffff",
          border: "var(--line)",
          radius: "var(--radius-lg)",
        }}
      />
    );
  }

  return (
    <CelebrityShellProvider>
      <Shell>{children}</Shell>
    </CelebrityShellProvider>
  );
}
