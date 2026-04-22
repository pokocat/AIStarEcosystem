"use client";

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, Music, Layers, Shield, TrendingUp,
  Globe as GlobeIcon, Wallet, Settings, LogOut, ChevronRight,
  Sparkles, Heart, ChevronDown, Menu, X,
  Star, CheckCircle2, Film, Tv, Mic,
  Wand2, Shirt, Building2,
  Bell, Coins
} from 'lucide-react';
import { Button } from "./ui/button";
import { motion, AnimatePresence } from "motion/react";
import { useTheme, themeConfig } from "./ThemeProvider";
import type { Lang } from "../translations";
import { MCNMatrix } from "./producer/MCNMatrix";
import { IncubationWizard } from "./producer/IncubationWizard";
import { WardrobePage } from "./producer/WardrobePage";
import { AppearanceForge } from "./producer/AppearanceForge";
import { AppearanceForgeV2 } from "./producer/AppearanceForge.v2";
import { AppearanceForgeV3 } from "./producer/AppearanceForge.v3";
import { DistributionPage } from "./producer/DistributionPage";
import { CopyrightPage } from "./producer/CopyrightPage";
import { CommunityPage } from "./producer/CommunityPage";
import { FinancePage } from "./producer/FinancePage";
import { SettingsPage } from "./producer/SettingsPage";
import { MusicBusiness } from "./MusicBusiness";
import { StudioPage } from "./producer/StudioPage";
import { NotificationPanel } from "./producer/NotificationPanel";
import { INITIAL_NOTIFICATIONS } from "@/mocks/notifications";
import type { Notification } from "@/types/notification";
import { NotificationsApi, AccountApi } from "@/api";
import { useAuth } from "@/lib/auth-context";
import { formatCredits } from "@/lib/format";
import type { Wallet as WalletSnapshot } from "@/types/wallet";
import { CommandPalette } from "./producer/CommandPalette";
import {
  ARTIST_TYPE_CONFIG, ARTIST_TYPE_LABELS,
  type Artist, type ArtistType
} from './producer/ArtistTypes';
import { OverviewSkeleton } from "./producer/SkeletonLoader";
import { usePageParam } from "@/lib/use-page-param";
import { useSearchParams } from "next/navigation";
import { useProducerDashboard } from "./producer/dashboard/hooks/use-producer-dashboard";
import { AgencyOverview } from "./producer/dashboard/AgencyOverview";
import { ArtistOverview } from "./producer/dashboard/ArtistOverview";
import { UserCircle } from 'lucide-react';

// ---- Sidebar Config（中文单语） ----
type ProducerPage =
  | 'overview' | 'artist' | 'artists' | 'incubator' | 'appearance' | 'wardrobe'
  | 'studio' | 'music' | 'copyright'
  | 'distribution' | 'community' | 'finance'
  | 'settings';

interface SidebarItemDef {
  id: ProducerPage;
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
    title: '总览',
    items: [
      { id: 'overview', icon: LayoutDashboard, label: '经纪大盘' },
      { id: 'artist',   icon: UserCircle,      label: '艺人视图' },
    ]
  },
  {
    title: '艺人管理',
    items: [
      { id: 'artists', icon: Users, label: 'MCN与孵化' },
      { id: 'incubator', icon: Wand2, label: 'AI艺人孵化' },
      { id: 'appearance', icon: Sparkles, label: 'AI形象锻造' },
      { id: 'wardrobe', icon: Shirt, label: '造型与道具' },
    ]
  },
  {
    title: '内容创作',
    items: [
      // studio 是按 activeArtist 类型动态命名的创作工坊（音乐 / 短剧 / 综艺…）；
      // music 是音乐业务 / 运营视图（与 StudioPage 不同层），改名「音乐商业」消歧义。
      { id: 'studio', icon: Music, label: '创作工坊', dynamicLabel: true },
      { id: 'music', icon: TrendingUp, label: '音乐商业' },
      { id: 'copyright', icon: Shield, label: '版权资产' },
    ]
  },
  {
    title: '商业运营',
    items: [
      { id: 'distribution', icon: GlobeIcon, label: '全网分发' },
      { id: 'community', icon: Heart, label: '粉丝社群' },
      { id: 'finance', icon: Wallet, label: '商业变现' },
    ]
  },
];

const SIDEBAR_COLLAPSED_KEY = 'aistareco.producer.sidebarCollapsed';

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

// OverviewPage 已迁移至 components/producer/dashboard/AgencyOverview.tsx，
// 此文件只保留"壳 + 页面路由"职责。

/* ======== Main Dashboard ======== */
const ProducerDashboard = ({ onLogout, lang, setLang }: { onLogout: () => void; lang: Lang; setLang: (l: Lang) => void }) => {
  // 本仓库已中文单语。lang/setLang 仍作为 prop 透传给尚未完成单语化的子组件（SettingsPage 等）。
  const { theme } = useTheme();
  const themeStyles = themeConfig[theme].sidebar;
  const { user, logout: authLogout } = useAuth();

  // 大盘共享数据（艺人/作品/月度收入）集中在 hook 里拉取。
  // 见 components/producer/dashboard/hooks/use-producer-dashboard.ts。
  const { artists, songs, monthlyRevenue, artistsLoading, dataLoading } = useProducerDashboard(user?.id);
  const [activeArtist, setActiveArtist] = useState<Artist | null>(null);
  // 艺人列表变化时同步 activeArtist（首次给第一位；切换账号后若当前 active 还在列表则保留）。
  useEffect(() => {
    setActiveArtist(prev => {
      if (prev && artists.some(a => a.id === prev.id)) return prev;
      return artists[0] ?? null;
    });
  }, [artists]);

  const [activePage, setActivePage] = usePageParam<ProducerPage>('overview');
  // Forge 版本切换：支持 v1 / v2 / v3，缺省保持旧版。
  const searchParamsRaw = useSearchParams();
  const forgeVariant = (() => {
    const raw = searchParamsRaw?.get('forge');
    if (raw === 'v3') return 'v3';
    if (raw === 'v2') return 'v2';
    return 'v1';
  })();
  // 侧边栏折叠状态持久化到 localStorage。
  // SSR 统一返回 true（展开），mount 后再读实际值，避免 SSR/CSR hydration 结构不一致。
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [sidebarHydrated, setSidebarHydrated] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1') setSidebarOpen(false);
    setSidebarHydrated(true);
  }, []);
  useEffect(() => {
    if (!sidebarHydrated || typeof window === 'undefined') return;
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarOpen ? '0' : '1');
  }, [sidebarOpen, sidebarHydrated]);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [showArtistSwitcher, setShowArtistSwitcher] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const unreadCount = notifications.filter(n => !n.read).length;
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);

  // 钱包快照：挂载时拉取一次；每次切换页面后重拉（尤其是从 finance 回到其它页面，
  // 顶栏金币气泡能反映最新余额）。失败保持旧值。
  useEffect(() => {
    let cancelled = false;
    AccountApi.getMyWallet()
      .then((w) => { if (!cancelled) setWallet(w); })
      .catch(() => { /* 钱包未开通或接口失败，保持占位 */ });
    return () => { cancelled = true; };
  }, [activePage]);

  // 加载真实通知。成功即以后端数据为准（即使为空），避免残留 mock ID 触发 404。
  useEffect(() => {
    let cancelled = false;
    NotificationsApi.listNotifications()
      .then((list) => {
        if (!cancelled && Array.isArray(list)) setNotifications(list);
      })
      .catch(() => { /* 静默失败，保留 mock 兜底仅在未收到响应时 */ });
    return () => { cancelled = true; };
  }, []);

  // Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const typeConf = activeArtist ? ARTIST_TYPE_CONFIG[activeArtist.type] : null;

  // Dynamic sidebar label for workshop（随 activeArtist 类型切换工坊名）
  const getSidebarLabel = (item: SidebarItemDef) => {
    if (item.dynamicLabel && typeConf) return typeConf.workshop.zh;
    return item.label;
  };

  // Dynamic workshop icon
  const getIcon = (item: { id: string; icon: any }) => {
    if (item.id === 'studio' && activeArtist) {
      const iconMap: Record<ArtistType, any> = {
        singer: Music, actor: Film, entertainer: Tv, dancer: Star,
        host: Mic, all_rounder: Layers, idol: Heart,
      };
      return iconMap[activeArtist.type] || Music;
    }
    return item.icon;
  };

  // 子组件（CommandPalette / FloatingActions / OverviewPage）用松散 string 约定；
  // 这里统一做一次类型收窄 — 未知 page 走 default 分支。
  const navigate = (page: string) => setActivePage(page as ProducerPage);

  // 近期作品点击：跳转到 studio（工坊列表）。StudioPage 当前不消费 songId，留参数占位未来接入。
  const openTrack = (_songId: string) => {
    setActivePage('studio');
  };

  // 需要 activeArtist 的页面在无签约艺人时显示友好空状态。
  const noArtistState = (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border-2 border-cyan-500/30 flex items-center justify-center mb-4">
        <Users className="w-7 h-7 text-cyan-300" />
      </div>
      <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>
        {artistsLoading ? '载入签约艺人中...' : '当前经纪公司暂无签约艺人'}
      </h2>
      <p className="text-sm text-gray-400 max-w-md mb-5 font-light">
        {artistsLoading
          ? '正在从后端拉取 /api/me/digital-ips，请稍候。'
          : '请先在「MCN与孵化」里创建一位 AI 艺人；或联系平台运营将现有艺人归属到当前 studio。'}
      </p>
      {!artistsLoading && (
        <div className="flex items-center gap-2">
          <Button onClick={() => setActivePage('artists')} className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90">
            进入艺人管理
          </Button>
          <Button variant="outline" onClick={() => setActivePage('incubator')} className="border-white/10">
            开启 AI 孵化向导
          </Button>
        </div>
      )}
    </div>
  );

  const renderPage = () => {
    // settings / artists / incubator 不依赖 activeArtist
    if (activePage === 'settings') return <SettingsPage lang={lang} setLang={setLang} />;
    if (activePage === 'artists') return <MCNMatrix lang={lang} onCreateArtist={() => setActivePage('incubator')} />;
    if (activePage === 'incubator') return <IncubationWizard lang={lang} onClose={() => setActivePage('artists')} onCreated={() => setActivePage('artists')} />;

    // overview 为公司视角，不需要 activeArtist；即使 0 艺人也能进入（内部会渲染空态引导）。
    if (activePage === 'overview') {
      if (dataLoading || artistsLoading) return <OverviewSkeleton />;
      return (
        <AgencyOverview
          artists={artists}
          songs={songs}
          monthlyRevenue={monthlyRevenue}
          activeArtistId={activeArtist?.id}
          onNavigate={navigate}
          onOpenTrack={openTrack}
          onSelectArtist={(a) => { setActiveArtist(a); setActivePage('artist'); }}
        />
      );
    }

    // 其余个体页面都需要一位 activeArtist
    if (!activeArtist) return noArtistState;

    if (activePage === 'artist') {
      return (
        <ArtistOverview
          artist={activeArtist}
          artists={artists}
          songs={songs}
          onSelectArtist={setActiveArtist}
          onNavigate={navigate}
        />
      );
    }

    switch (activePage) {
      case 'studio': return <StudioPage lang={lang} activeArtist={activeArtist} />;
      case 'music': return <MusicBusiness lang={lang} artist={{ id: activeArtist.id, name: activeArtist.name, avatar: activeArtist.avatar }} onBack={() => setActivePage('overview')} />;
      case 'appearance':
        return forgeVariant === 'v3'
          ? <AppearanceForgeV3
              lang={lang}
              activeArtist={activeArtist}
              onArtistAvatarSaved={(nextAvatar: string) => {
                setActiveArtist(prev => prev && prev.id === activeArtist.id
                  ? { ...prev, avatar: nextAvatar }
                  : prev);
              }}
            />
          : forgeVariant === 'v2'
            ? <AppearanceForgeV2 lang={lang} activeArtist={activeArtist} />
            : <AppearanceForge lang={lang} activeArtist={activeArtist} />;
      case 'wardrobe': return <WardrobePage lang={lang} activeArtist={activeArtist} />;
      case 'distribution': return <DistributionPage lang={lang} activeArtist={activeArtist} />;
      case 'copyright': return <CopyrightPage lang={lang} activeArtist={activeArtist} />;
      case 'community': return <CommunityPage lang={lang} activeArtist={activeArtist} />;
      case 'finance': return <FinancePage lang={lang} activeArtist={activeArtist} />;
      default:
        if (dataLoading || artistsLoading) return <OverviewSkeleton />;
        return (
          <AgencyOverview
            artists={artists}
            songs={songs}
            monthlyRevenue={monthlyRevenue}
            activeArtistId={activeArtist?.id}
            onNavigate={navigate}
            onOpenTrack={openTrack}
            onSelectArtist={setActiveArtist}
          />
        );
    }
  };

  const currentPageLabel = (() => {
    for (const group of SIDEBAR_GROUPS) {
      const item = group.items.find(i => i.id === activePage);
      if (item) return getSidebarLabel(item);
    }
    return '';
  })();

  const renderSidebarContent = (isMobile = false) => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/5">
        <Sparkles className="w-6 h-6 text-cyan-400 shrink-0" />
        {(sidebarOpen || isMobile) && (
          <span className="text-base font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent whitespace-nowrap" style={{ fontFamily: "var(--font-display)" }}>AI Star Eco</span>
        )}
        {isMobile && <button onClick={() => setMobileSidebar(false)} className="ml-auto"><X className="w-5 h-5 text-gray-400" /></button>}
      </div>

      {/* Active artist switcher — 数据源：GET /api/me/digital-ips（经纪公司签约艺人列表） */}
      {(sidebarOpen || isMobile) && (
        <div className="px-3 py-3 border-b border-white/5 relative">
          <button
            onClick={() => activeArtist && setShowArtistSwitcher(!showArtistSwitcher)}
            disabled={!activeArtist}
            className="w-full flex items-center gap-3 p-2 rounded-lg bg-white/[0.03] cursor-pointer hover:bg-white/[0.06] transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {activeArtist && typeConf ? (
              <>
                <div className="relative">
                  <img src={activeArtist.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-cyan-500/20" />
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ${typeConf.bgColor} flex items-center justify-center text-[8px]`}>{typeConf.icon}</div>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-semibold truncate">{activeArtist.name}</div>
                  <div className="text-[10px] text-gray-500 flex items-center gap-1">
                    {ARTIST_TYPE_LABELS[activeArtist.type].zh}
                    <span className="text-cyan-400">Lv.{activeArtist.level}</span>
                  </div>
                </div>
                <ChevronDown className={`w-3 h-3 text-gray-500 transition ${showArtistSwitcher ? 'rotate-180' : ''}`} />
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-500">
                  <Users className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-semibold truncate text-gray-400">
                    {artistsLoading ? '载入中...' : '暂无签约艺人'}
                  </div>
                  <div className="text-[10px] text-gray-500">点击上方「MCN与孵化」创建</div>
                </div>
              </>
            )}
          </button>
          {/* Dropdown */}
          <AnimatePresence>
            {showArtistSwitcher && activeArtist && (
              <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                className="absolute left-3 right-3 top-full mt-1 bg-gray-900 border border-white/10 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                {artists.length === 0 ? (
                  <div className="text-xs text-gray-500 text-center py-4 px-3">暂无可选艺人</div>
                ) : artists.map(artist => {
                  const tc = ARTIST_TYPE_CONFIG[artist.type];
                  return (
                    <button key={artist.id}
                      onClick={() => { setActiveArtist(artist); setShowArtistSwitcher(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition text-left ${artist.id === activeArtist.id ? 'bg-white/[0.03]' : ''}`}>
                      <img src={artist.avatar} alt="" className="w-7 h-7 rounded-full object-cover border border-white/10" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate">{artist.name}</div>
                        <div className="text-[10px] text-gray-500">{tc.icon} Lv.{artist.level}</div>
                      </div>
                      {artist.id === activeArtist.id && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Nav items grouped */}
      <div className="flex-1 px-3 py-2 overflow-y-auto">
        {SIDEBAR_GROUPS.map((group, gi) => (
          <div key={gi} className="mb-3">
            {(sidebarOpen || isMobile) && (
              <div className="text-[10px] text-gray-600 uppercase tracking-widest font-medium px-3 py-2">{group.title}</div>
            )}
            <div className="space-y-0.5">
              {group.items.map(item => (
                <SidebarItem
                  key={item.id}
                  icon={getIcon(item)}
                  label={(sidebarOpen || isMobile) ? getSidebarLabel(item) : ''}
                  id={item.id}
                  active={activePage}
                  onClick={(id: string) => { navigate(id); if (isMobile) setMobileSidebar(false); }}
                  themeStyles={themeStyles}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom */}
      <div className="px-3 py-3 border-t border-white/5 space-y-1">
        <SidebarItem icon={Settings} label={(sidebarOpen || isMobile) ? '设置' : ''} id="settings" active={activePage} onClick={navigate} themeStyles={themeStyles} />
        <button onClick={() => { authLogout(); onLogout(); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${themeStyles.itemBase}`}>
          <LogOut size={18} />
          {(sidebarOpen || isMobile) && <span className="font-medium">退出登录</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="h-screen w-full flex bg-black text-white overflow-hidden" style={{ fontFamily: "var(--font-sans, 'Inter', sans-serif)" }}>
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileSidebar(false)} className="md:hidden fixed inset-0 bg-black/60 z-40" />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: "spring", damping: 25 }}
              className={`md:hidden fixed left-0 top-0 bottom-0 w-[260px] ${themeStyles.bg} border-r ${themeStyles.border} z-50 flex flex-col`}>
              {renderSidebarContent(true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-white/5 bg-black/50 backdrop-blur-lg shrink-0">
          <div className="flex items-center gap-3">
            <button className="md:hidden" onClick={() => setMobileSidebar(true)}><Menu className="w-5 h-5 text-gray-400" /></button>
            <button className="hidden md:block" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="w-5 h-5 text-gray-400 hover:text-white transition" />
            </button>
            <div className="text-sm text-gray-500 font-light">{currentPageLabel}</div>
            <button onClick={() => setShowCommandPalette(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] border border-white/5 rounded-lg text-xs text-gray-500 hover:border-white/15 hover:text-gray-300 transition ml-2">
              <span>搜索...</span>
              <kbd className="text-[10px] bg-white/5 rounded px-1 py-0.5 border border-white/10">⌘K</kbd>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActivePage('finance')}
              title="点击查看账单流水"
              className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-full px-3 py-1.5 transition">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-semibold text-amber-300 tabular-nums">
                {wallet ? formatCredits(wallet.totalBalance) : '—'}
              </span>
            </button>
            <div className="relative">
              <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 rounded-lg hover:bg-white/10 transition text-gray-400 hover:text-white">
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />}
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
              onClick={() => setActivePage('settings')}
              title="进入个人设置"
              className="flex items-center gap-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-cyan-500/30 rounded-full pl-1 pr-3 py-1 transition group"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 border border-cyan-500/30 flex items-center justify-center shrink-0">
                <Building2 className="w-3.5 h-3.5 text-cyan-300" />
              </div>
              <span className="text-xs font-semibold text-gray-200 group-hover:text-white hidden sm:block max-w-[160px] truncate">
                {user?.studio?.name ?? (user?.displayName ?? '未关联经纪公司')}
              </span>
              <ChevronRight className="w-3 h-3 text-gray-500 group-hover:text-cyan-400 hidden sm:block" />
            </button>
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <AnimatePresence mode="wait">
            <motion.div key={activePage} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: .25 }}>
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Command Palette */}
        <CommandPalette
          lang={lang}
          open={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
          onNavigate={navigate}
          onSwitchArtist={setActiveArtist}
          artists={artists}
        />

      </div>
    </div>
  );
};

export default ProducerDashboard;
