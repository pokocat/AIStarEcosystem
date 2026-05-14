"use client";

// ─────────────────────────────────────────────────────────────────────────────
// /producer 的共享外壳：侧边栏、顶栏、命令面板、通知面板、ProducerShellProvider。
// 各子页只负责渲染内容区；共享状态通过 useProducerShell() 消费。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Music, Layers, Shield, TrendingUp,
  Globe as GlobeIcon, Wallet, Settings, LogOut, ChevronRight,
  Sparkles, AudioLines, Heart, ChevronDown, Menu, X,
  Star, CheckCircle2, Film, Tv, Mic,
  Wand2, Shirt, Building2, Bell, Coins, UserCircle,
  Megaphone,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLang } from "@/lib/lang-context";
import { useAuth } from "@ai-star-eco/api-client";
import { useTheme, themeConfig } from "@ai-star-eco/ui";
import { CommandPalette } from "@/components/producer/CommandPalette";
import { NotificationPanel } from "@/components/producer/NotificationPanel";
import {
  ARTIST_TYPE_CONFIG, ARTIST_TYPE_LABELS,
  type ArtistType,
} from "@/components/producer/ArtistTypes";
import { formatCredits } from "@/lib/format";
import {
  ProducerShellProvider,
  useProducerShell,
} from "@/lib/producer-shell-context";

// ─────────────────────────────────────────────────────────────────────────────
// 侧栏配置（中文单语）。id 与 URL 段一致：/producer/<id>（overview 对应 /producer 根）
// ─────────────────────────────────────────────────────────────────────────────
interface SidebarItemDef {
  id: string;
  icon: any;
  label: string;
  /** true 时由 activeArtist 类型动态覆盖（创作工坊随艺人类型换名） */
  dynamicLabel?: boolean;
}

interface SidebarGroup {
  title: string;
  items: SidebarItemDef[];
}

const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    title: "总览",
    items: [
      { id: "overview", icon: LayoutDashboard, label: "经纪大盘" },
      { id: "artist", icon: UserCircle, label: "艺人视图" },
    ],
  },
  {
    title: "艺人管理",
    items: [
      { id: "artists", icon: Users, label: "MCN与孵化" },
      { id: "incubator", icon: Wand2, label: "AI艺人孵化" },
      { id: "appearance", icon: Sparkles, label: "AI形象锻造" },
      { id: "wardrobe", icon: Shirt, label: "造型与道具" },
    ],
  },
  {
    title: "内容创作",
    items: [
      { id: "studio", icon: Music, label: "创作工坊", dynamicLabel: true },
      { id: "music", icon: TrendingUp, label: "音乐商业" },
      { id: "copyright", icon: Shield, label: "版权资产" },
    ],
  },
  {
    title: "商业运营",
    items: [
      { id: "distribution", icon: GlobeIcon, label: "全网分发" },
      { id: "community", icon: Heart, label: "粉丝社群" },
      { id: "finance", icon: Wallet, label: "商业变现" },
    ],
  },
  {
    title: "明星带货",
    items: [
      { id: "celebrity-zone", icon: Megaphone, label: "AI 明星专区" },
    ],
  },
];

const SIDEBAR_COLLAPSED_KEY = "aistareco.producer.sidebarCollapsed";

/**
 * 顶层路径 → sidebar 内部 id。/dashboard → 'overview'（侧栏第一项 id）；
 * /artist → 'artist'；/artist/foo → 'artist'（只取首段）。
 */
function pathToActiveId(pathname: string | null): string {
  if (!pathname) return "overview";
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return "overview";
  if (parts[0] === "dashboard") return "overview";
  return parts[0];
}

const SidebarItem = ({ icon: Icon, label, id, active, onClick, themeStyles }: any) => (
  <button
    onClick={() => onClick(id)}
    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
      active === id ? themeStyles.itemActive : themeStyles.itemBase
    }`}
  >
    <Icon size={18} />
    <span className="font-medium">{label}</span>
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// Layout 根：装载 ProducerShellProvider。旧 ?tab=xxx 兼容已移到 proxy.ts。
// ─────────────────────────────────────────────────────────────────────────────
export default function ProducerLayout({ children }: { children: React.ReactNode }) {
  return (
    <React.Suspense fallback={<ShellFallback />}>
      <ProducerLayoutInner>{children}</ProducerLayoutInner>
    </React.Suspense>
  );
}

function ShellFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      正在加载制作人端...
    </div>
  );
}

function ProducerLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { lang, setLang } = useLang();
  const { logout: authLogout } = useAuth();

  const onLogout = React.useCallback(() => {
    authLogout();
    router.push("/login");
  }, [authLogout, router]);

  return (
    <ProducerShellProvider lang={lang} setLang={setLang} onLogout={onLogout} currentPath={pathname}>
      <ProducerShell>{children}</ProducerShell>
    </ProducerShellProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 外壳本体：侧栏 + 顶栏 + 主区 + 命令面板
// ─────────────────────────────────────────────────────────────────────────────
function ProducerShell({ children }: { children: React.ReactNode }) {
  const {
    user, onLogout,
    activeArtist, setActiveArtist, artists, artistsLoading,
    wallet, notifications, setNotifications, unreadCount,
    navigate, lang, currentPath,
  } = useProducerShell();
  const { theme } = useTheme();
  const themeStyles = themeConfig[theme].sidebar;

  const activeId = pathToActiveId(currentPath);

  // 侧栏折叠（SSR → true；挂载后读 localStorage）
  const [sidebarOpen, setSidebarOpen] = React.useState<boolean>(true);
  const [sidebarHydrated, setSidebarHydrated] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1") setSidebarOpen(false);
    setSidebarHydrated(true);
  }, []);
  React.useEffect(() => {
    if (!sidebarHydrated || typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarOpen ? "0" : "1");
  }, [sidebarOpen, sidebarHydrated]);

  const [mobileSidebar, setMobileSidebar] = React.useState(false);
  const [showArtistSwitcher, setShowArtistSwitcher] = React.useState(false);
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [showCommandPalette, setShowCommandPalette] = React.useState(false);

  // Cmd+K
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const typeConf = activeArtist ? ARTIST_TYPE_CONFIG[activeArtist.type] : null;

  const getSidebarLabel = (item: SidebarItemDef) => {
    if (item.dynamicLabel && typeConf) return typeConf.workshop.zh;
    return item.label;
  };

  const getIcon = (item: { id: string; icon: any }) => {
    if (item.id === "studio" && activeArtist) {
      const iconMap: Record<ArtistType, any> = {
        singer: Music, actor: Film, entertainer: Tv, dancer: Star,
        host: Mic, all_rounder: Layers, idol: Heart,
      };
      return iconMap[activeArtist.type] || Music;
    }
    return item.icon;
  };

  const currentPageLabel = (() => {
    for (const group of SIDEBAR_GROUPS) {
      const item = group.items.find((i) => i.id === activeId);
      if (item) return getSidebarLabel(item);
    }
    return "";
  })();

  const handleNav = React.useCallback(
    (id: string) => {
      navigate(id);
    },
    [navigate],
  );

  const renderSidebarContent = (isMobile = false) => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
        <div className="w-7 h-7 rounded-md bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
          <AudioLines className="w-4 h-4 text-primary" strokeWidth={2.25} />
        </div>
        {(sidebarOpen || isMobile) && (
          <div className="leading-tight whitespace-nowrap">
            <div className="text-sm font-semibold tracking-tight text-foreground">AI 音乐人</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">AI Star Eco</div>
          </div>
        )}
        {isMobile && (
          <button onClick={() => setMobileSidebar(false)} className="ml-auto">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Active artist switcher */}
      {(sidebarOpen || isMobile) && (
        <div className="px-3 py-3 border-b border-border relative">
          <button
            onClick={() => activeArtist && setShowArtistSwitcher(!showArtistSwitcher)}
            disabled={!activeArtist}
            className="w-full flex items-center gap-3 p-2 rounded-lg bg-secondary/60 cursor-pointer hover:bg-secondary transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {activeArtist && typeConf ? (
              <>
                <div className="relative">
                  <img src={activeArtist.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-border" />
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ${typeConf.bgColor} flex items-center justify-center text-[8px]`}>
                    {typeConf.icon}
                  </div>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-semibold truncate">{activeArtist.name}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                    {ARTIST_TYPE_LABELS[activeArtist.type].zh}
                    <span className="text-primary">Lv.{activeArtist.level}</span>
                  </div>
                </div>
                <ChevronDown className={`w-3 h-3 text-muted-foreground transition ${showArtistSwitcher ? "rotate-180" : ""}`} />
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <Users className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-semibold truncate text-foreground/70">
                    {artistsLoading ? "载入中..." : "暂无签约艺人"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">点击上方「MCN与孵化」创建</div>
                </div>
              </>
            )}
          </button>

          <AnimatePresence>
            {showArtistSwitcher && activeArtist && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="absolute left-3 right-3 top-full mt-1 bg-popover border border-border rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto"
              >
                {artists.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-4 px-3">暂无可选艺人</div>
                ) : (
                  artists.map((artist) => {
                    const tc = ARTIST_TYPE_CONFIG[artist.type];
                    return (
                      <button
                        key={artist.id}
                        onClick={() => {
                          setActiveArtist(artist);
                          setShowArtistSwitcher(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary transition text-left ${
                          artist.id === activeArtist.id ? "bg-secondary/70" : ""
                        }`}
                      >
                        <img src={artist.avatar} alt="" className="w-7 h-7 rounded-full object-cover border border-border" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate">{artist.name}</div>
                          <div className="text-[10px] text-muted-foreground">{tc.icon} Lv.{artist.level}</div>
                        </div>
                        {artist.id === activeArtist.id && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                      </button>
                    );
                  })
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Nav items */}
      <div className="flex-1 px-3 py-2 overflow-y-auto">
        {SIDEBAR_GROUPS.map((group, gi) => (
          <div key={gi} className="mb-3">
            {(sidebarOpen || isMobile) && (
              <div className="text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium px-3 py-2">
                {group.title}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <SidebarItem
                  key={item.id}
                  icon={getIcon(item)}
                  label={(sidebarOpen || isMobile) ? getSidebarLabel(item) : ""}
                  id={item.id}
                  active={activeId}
                  onClick={(id: string) => {
                    handleNav(id);
                    if (isMobile) setMobileSidebar(false);
                  }}
                  themeStyles={themeStyles}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom */}
      <div className="px-3 py-3 border-t border-border space-y-1">
        <SidebarItem
          icon={Settings}
          label={(sidebarOpen || isMobile) ? "设置" : ""}
          id="settings"
          active={activeId}
          onClick={handleNav}
          themeStyles={themeStyles}
        />
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${themeStyles.itemBase}`}
        >
          <LogOut size={18} />
          {(sidebarOpen || isMobile) && <span className="font-medium">退出登录</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="h-screen w-full flex bg-background text-foreground overflow-hidden">
      {/* Sidebar — Desktop */}
      <motion.aside
        initial={{ width: 260 }}
        animate={{ width: sidebarOpen ? 260 : 72 }}
        className={`hidden md:flex flex-col ${themeStyles.bg} border-r ${themeStyles.border} shrink-0 overflow-hidden`}
      >
        {renderSidebarContent()}
      </motion.aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileSidebar && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileSidebar(false)}
              className="md:hidden fixed inset-0 bg-background/70 backdrop-blur-sm z-40"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25 }}
              className={`md:hidden fixed left-0 top-0 bottom-0 w-[260px] ${themeStyles.bg} border-r ${themeStyles.border} z-50 flex flex-col`}
            >
              {renderSidebarContent(true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar
            relative z-50：backdrop-blur 创建了堆叠上下文，但默认 z-auto 与 page-content 同级，
            源码顺序里 page-content 在后会覆盖 topbar 内的 NotificationPanel（z-[110] 仅 topbar 内部生效）。
            显式 z-50 把整个 topbar 堆叠上下文提到 page-content 之上。 */}
        <div className="relative z-50 flex items-center justify-between px-4 md:px-6 py-3 border-b border-border bg-background shrink-0">
          <div className="flex items-center gap-3">
            <button className="md:hidden" onClick={() => setMobileSidebar(true)}>
              <Menu className="w-5 h-5 text-muted-foreground" />
            </button>
            <button className="hidden md:block" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="w-5 h-5 text-muted-foreground hover:text-foreground transition" />
            </button>
            <div className="text-sm font-medium text-foreground/85">{currentPageLabel}</div>
            <button
              onClick={() => setShowCommandPalette(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-secondary/70 border border-border rounded-md text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition ml-2"
            >
              <span>搜索...</span>
              <kbd className="text-[10px] bg-muted rounded px-1 py-0.5 border border-border">⌘K</kbd>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleNav("finance")}
              title="点击查看账单流水"
              className="flex items-center gap-1.5 bg-secondary/70 hover:bg-secondary border border-border rounded-md px-3 py-1.5 transition"
            >
              <Coins className="w-3.5 h-3.5 text-amber-400/90" />
              <span className="text-xs font-semibold text-foreground tabular-nums">
                {wallet ? formatCredits(wallet.totalBalance) : "—"}
              </span>
            </button>
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-md hover:bg-secondary transition text-muted-foreground hover:text-foreground"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive" />}
              </button>
              <NotificationPanel
                lang={lang}
                open={showNotifications}
                onClose={() => setShowNotifications(false)}
                notifications={notifications}
                setNotifications={setNotifications}
              />
            </div>
            <button
              onClick={() => handleNav("settings")}
              title="进入个人设置"
              className="flex items-center gap-2 bg-secondary/70 hover:bg-secondary border border-border hover:border-primary/40 rounded-full pl-1 pr-3 py-1 transition group"
            >
              <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
                <Building2 className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-xs font-semibold text-foreground/85 group-hover:text-foreground hidden sm:block max-w-[160px] truncate">
                {user?.studio?.name ?? (user?.displayName ?? "未关联经纪公司")}
              </span>
              <ChevronRight className="w-3 h-3 text-muted-foreground hidden sm:block" />
            </button>
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* h-full 让 children 里的 `flex flex-col h-full` 高度链生效（如 incubator）。
              非 h-full 用法的子页内容自然溢出，由外层 overflow-y-auto 负责滚动，互不影响。 */}
          <div key={activeId} className="h-full">{children}</div>
        </div>

        <CommandPalette
          lang={lang}
          open={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
          onNavigate={(p: string) => handleNav(p)}
          onSwitchArtist={setActiveArtist}
          artists={artists}
        />
      </div>
    </div>
  );
}
