"use client";

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, Mic2, Music, Disc, Layers, Shield, TrendingUp,
  Globe as GlobeIcon, Wallet, Settings, LogOut, ChevronRight, Plus,
  Play, Pause, BarChart3, Zap, Sparkles, ArrowRight, Crown,
  Heart, Eye, Upload, ChevronDown, Menu, X, ArrowUpRight,
  Headphones, Star, Clock, CheckCircle2, AlertCircle, Rocket, Video,
  Film, ShoppingBag, Tv, Mic, GraduationCap, Gamepad, Award,
  Wand2, Shirt, Grid3X3, Building2
} from 'lucide-react';
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import { motion, AnimatePresence } from "motion/react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { useTheme, themeConfig } from "./ThemeProvider";
import { TRANSLATIONS, type Lang } from "../translations";
import { MCNMatrix } from "./producer/MCNMatrix";
import { IncubationWizard } from "./producer/IncubationWizard";
import { WardrobePage } from "./producer/WardrobePage";
import { AppearanceForge } from "./producer/AppearanceForge";
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
import { NotificationsApi, AccountApi, ArtistsApi } from "@/api";
import { useAuth } from "@/lib/auth-context";
import { Bell, Coins } from 'lucide-react';
import { formatCredits } from "@/lib/format";
import type { Wallet as WalletSnapshot } from "@/types/wallet";
import { CommandPalette } from "./producer/CommandPalette";
import { ArtistRadarCard } from "./producer/ArtistRadarCard";
import {
  MOCK_ARTISTS, ARTIST_TYPE_CONFIG, ARTIST_TYPE_LABELS, DOMAINS_8,
  type Artist, type ArtistType
} from './producer/ArtistTypes';
import { ActivityFeed } from "./producer/ActivityFeed";
import { FloatingActions } from "./producer/FloatingActions";
import { OverviewSkeleton } from "./producer/SkeletonLoader";
import { usePageParam } from "@/lib/use-page-param";

const EARNING_DATA = [
  { name: '1月', song: 4000, nft: 2400, tips: 1200 },
  { name: '2月', song: 3000, nft: 1398, tips: 800 },
  { name: '3月', song: 5200, nft: 3800, tips: 2100 },
  { name: '4月', song: 2780, nft: 3908, tips: 1500 },
  { name: '5月', song: 6890, nft: 4800, tips: 3200 },
  { name: '6月', song: 8390, nft: 6300, tips: 4100 },
];

const TRACKS = [
  { id: 1, title: 'Neon Tears', status: 'Published', plays: '450K', date: '2024-03-10', revenue: '¥8,200' },
  { id: 2, title: 'Cyber City Vibe', status: 'Draft', plays: '-', date: '2024-03-12', revenue: '-' },
  { id: 3, title: 'Digital Sunset', status: 'Published', plays: '1.2M', date: '2024-02-28', revenue: '¥21,500' },
  { id: 4, title: 'Midnight Protocol', status: 'Review', plays: '-', date: '2024-03-15', revenue: '-' },
  { id: 5, title: 'Ghost Signal', status: 'Published', plays: '320K', date: '2024-01-20', revenue: '¥5,600' },
];

// ---- Sidebar Config ----
interface SidebarGroup {
  title: { zh: string; en: string };
  items: { id: string; icon: any; zh: string; en: string; dynamicLabel?: boolean }[];
}

const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    title: { zh: '总览', en: 'Overview' },
    items: [
      { id: 'overview', icon: LayoutDashboard, zh: '经纪大盘', en: 'Dashboard' },
    ]
  },
  {
    title: { zh: '艺人管理', en: 'Artist Mgmt' },
    items: [
      { id: 'artists', icon: Users, zh: 'MCN与孵化', en: 'MCN Matrix' },
      { id: 'incubator', icon: Wand2, zh: 'AI艺人孵化', en: 'AI Incubator' },
      { id: 'appearance', icon: Sparkles, zh: 'AI形象锻造', en: 'Appearance Forge' },
      { id: 'wardrobe', icon: Shirt, zh: '造型与道具', en: 'Wardrobe' },
    ]
  },
  {
    title: { zh: '内容创作', en: 'Creation' },
    items: [
      { id: 'studio', icon: Music, zh: '创作工坊', en: 'Workshop', dynamicLabel: true },
      { id: 'music', icon: Music, zh: '音乐工坊', en: 'Music Workshop' },
      { id: 'copyright', icon: Shield, zh: '版权资产', en: 'Copyright' },
    ]
  },
  {
    title: { zh: '商业运营', en: 'Business' },
    items: [
      { id: 'distribution', icon: GlobeIcon, zh: '全网分发', en: 'Distribution' },
      { id: 'community', icon: Heart, zh: '粉丝社群', en: 'Community' },
      { id: 'finance', icon: Wallet, zh: '商业变现', en: 'Monetization' },
    ]
  },
];

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

/* ======== Enhanced Overview Page ======== */
const OverviewPage = ({ lang, activeSinger, onNavigate, onOpenTrack }: { lang: Lang; activeSinger: Artist; onNavigate: (page: string) => void; onOpenTrack: (trackId: number) => void }) => {
  const zh = lang === 'zh';
  const t = TRANSLATIONS[lang].producer.overview;

  // Type distribution for pie chart
  const typeDist = (() => {
    const counts: Record<string, number> = {};
    MOCK_ARTISTS.forEach(a => {
      const label = zh ? ARTIST_TYPE_LABELS[a.type].zh : ARTIST_TYPE_LABELS[a.type].en;
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  })();

  const PIE_COLORS = ['#06b6d4', '#a855f7', '#f59e0b', '#ec4899', '#22c55e', '#ef4444', '#6366f1'];

  const statusCounts = {
    total: MOCK_ARTISTS.length,
    active: MOCK_ARTISTS.filter(a => a.status === 'active').length,
    training: MOCK_ARTISTS.filter(a => ['trainee', 'debut'].includes(a.status)).length,
    rest: MOCK_ARTISTS.filter(a => a.status === 'rest' || a.status === 'retired').length,
  };

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{t.welcome}</h1>
        <p className="text-gray-400 font-light mt-1">{t.subtitle}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: t.eco_value, value: '¥2.4M', icon: Crown, color: 'text-amber-400', bg: 'bg-amber-500/10', change: '+18.5%' },
          { label: t.rev, value: '¥45.2K', icon: TrendingUp, color: 'text-cyan-400', bg: 'bg-cyan-500/10', change: '+12.3%' },
          { label: t.holders, value: '3,248', icon: Star, color: 'text-purple-400', bg: 'bg-purple-500/10', change: '+248' },
          { label: t.streams, value: '5.8M', icon: Play, color: 'text-pink-400', bg: 'bg-pink-500/10', change: '+1.2M' },
          { label: t.fans, value: '162K', icon: Users, color: 'text-green-400', bg: 'bg-green-500/10', change: '+8.4K' },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .08 }}
            className="bg-gray-900/50 border border-white/5 rounded-xl p-4 hover:border-white/10 transition group">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <span className="text-xs text-green-400 font-medium">{stat.change}</span>
            </div>
            <div className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{stat.value}</div>
            <div className="text-xs text-gray-500 font-light mt-1">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Artist Matrix Overview + Type Distribution */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Artist Radar Card - active artist talent overview */}
        <ArtistRadarCard lang={lang} artist={activeSinger} />

        {/* Type distribution pie */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .35 }}
          className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-bold tracking-tight mb-4" style={{ fontFamily: "var(--font-display)" }}>{zh ? '类型分布' : 'Type Distribution'}</h3>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={typeDist} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                  {typeDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {typeDist.map((d, i) => (
              <span key={i} className="text-[10px] text-gray-400 flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                {d.name}
              </span>
            ))}
          </div>
        </motion.div>

        {/* 8 Domains overview */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .4 }}
          className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-bold tracking-tight mb-4" style={{ fontFamily: "var(--font-display)" }}>{zh ? '8大领域' : '8 Domains'}</h3>
          <div className="grid grid-cols-2 gap-2">
            {DOMAINS_8.map((d, i) => (
              <motion.div key={d.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .5 + i * .04 }}
                className={`${d.bg} rounded-lg p-2.5 flex items-center gap-2 cursor-pointer hover:opacity-80 transition`}>
                <span className={`text-xs ${d.color}`}>{zh ? d.zh : d.en}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Chart + Tasks */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gray-900/50 border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-bold tracking-tight mb-4" style={{ fontFamily: "var(--font-display)" }}>{t.chart_title}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={EARNING_DATA}>
              <defs>
                <linearGradient id="colorSong" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorNft" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke="#555" fontSize={12} />
              <YAxis stroke="#555" fontSize={12} />
              <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="song" stroke="#06b6d4" fill="url(#colorSong)" strokeWidth={2} />
              <Area type="monotone" dataKey="nft" stroke="#a855f7" fill="url(#colorNft)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-bold tracking-tight mb-1" style={{ fontFamily: "var(--font-display)" }}>{t.tasks_title}</h3>
          <p className="text-xs text-gray-500 font-light mb-4">{t.tasks_desc}</p>
          <div className="space-y-3">
            {t.tasks.map((task: any, i: number) => {
              const priorities = ['text-red-400 bg-red-500/10', 'text-amber-400 bg-amber-500/10', 'text-cyan-400 bg-cyan-500/10'];
              return (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .3 + i * .1 }}
                  className="bg-black/30 border border-white/5 rounded-lg p-3 hover:border-cyan-500/20 transition cursor-pointer group">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      <span className="text-sm font-semibold text-white">{task.t}</span>
                    </div>
                    <Badge className={`text-[10px] border-0 ${priorities[i] || priorities[2]}`}>{zh ? ['紧急', '重要', '建议'][i] : ['Urgent', 'Important', 'Suggested'][i]}</Badge>
                  </div>
                  <p className="text-xs text-gray-500 font-light pl-3.5">{task.d}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Tracks */}
      <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{zh ? '近期作品' : 'Recent Tracks'}</h3>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('studio')} className="text-cyan-400 hover:bg-cyan-500/10 text-xs">{zh ? '查看全部' : 'View All'} <ChevronRight className="w-3 h-3 ml-1" /></Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {[zh ? '曲名' : 'Title', zh ? '状态' : 'Status', zh ? '播放量' : 'Plays', zh ? '收入' : 'Revenue', zh ? '日期' : 'Date'].map((h, i) => (
                  <th key={i} className="text-left text-xs text-gray-500 font-medium uppercase tracking-wider pb-3 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TRACKS.map((track, i) => (
                <motion.tr key={track.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * .05 }}
                  onClick={() => onOpenTrack(track.id)}
                  className="border-b border-white/5 hover:bg-white/[0.02] transition cursor-pointer">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-cyan-500/10 flex items-center justify-center"><Music className="w-4 h-4 text-cyan-400" /></div>
                      <span className="text-sm font-semibold">{track.title}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge className={`text-xs font-medium ${
                      track.status === 'Published' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                      track.status === 'Draft' ? 'bg-gray-500/10 text-gray-400 border-gray-500/20' :
                      'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>{track.status}</Badge>
                  </td>
                  <td className="py-3 pr-4 text-sm text-gray-400 font-light">{track.plays}</td>
                  <td className="py-3 pr-4 text-sm text-gray-400 font-light">{track.revenue}</td>
                  <td className="py-3 text-sm text-gray-500 font-light">{track.date}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity Feed */}
      <ActivityFeed lang={lang} />
    </div>
  );
};

// StudioPage 已拆分至 ./producer/StudioPage.tsx（LLM Playground + 真实歌曲列表）

/* ======== Main Dashboard ======== */
const ProducerDashboard = ({ onLogout, lang, setLang }: { onLogout: () => void; lang: Lang; setLang: (l: Lang) => void }) => {
  const zh = lang === 'zh';
  const { theme } = useTheme();
  const themeStyles = themeConfig[theme].sidebar;
  const { user, logout: authLogout } = useAuth();
  // 艺人列表 = 当前经纪公司名下签约艺人（ownerUserId OR studioId == myStudio.id）
  // 由后端 GET /api/me/digital-ips 驱动；USE_MOCK=1 时 api 层回退到 mocks/artists.ts。
  const [artists, setArtists] = useState<Artist[]>([]);
  const [artistsLoading, setArtistsLoading] = useState(true);
  const [activeArtist, setActiveArtist] = useState<Artist | null>(null);
  const [activePage, setActivePage] = usePageParam<string>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [showArtistSwitcher, setShowArtistSwitcher] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const unreadCount = notifications.filter(n => !n.read).length;
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    AccountApi.getMyWallet()
      .then((w) => { if (!cancelled) setWallet(w); })
      .catch(() => { /* 钱包未开通或接口失败，保持占位 */ });
    return () => { cancelled = true; };
  }, []);

  // 拉取经纪公司签约艺人列表。activeArtist 初始取第一位（列表为空即 null）。
  useEffect(() => {
    let cancelled = false;
    setArtistsLoading(true);
    ArtistsApi.listArtists()
      .then(list => {
        if (cancelled) return;
        setArtists(list);
        setActiveArtist(prev => {
          if (prev && list.some(a => a.id === prev.id)) return prev;
          return list[0] ?? null;
        });
      })
      .catch(() => { /* 静默失败，artists 保持空 */ })
      .finally(() => { if (!cancelled) setArtistsLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id]);

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

  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);

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

  // Dynamic sidebar label for workshop
  const getSidebarLabel = (item: { id: string; zh: string; en: string; dynamicLabel?: boolean }) => {
    if (item.dynamicLabel && typeConf) {
      return zh ? typeConf.workshop.zh : typeConf.workshop.en;
    }
    return zh ? item.zh : item.en;
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

  const openTrack = (trackId: number) => {
    setSelectedTrackId(trackId);
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
    // settings 和 artists/incubator 不依赖 activeArtist
    if (activePage === 'settings') return <SettingsPage lang={lang} setLang={setLang} />;
    if (activePage === 'artists') return <MCNMatrix lang={lang} onCreateArtist={() => setActivePage('incubator')} />;
    if (activePage === 'incubator') return <IncubationWizard lang={lang} onClose={() => setActivePage('artists')} onCreated={() => setActivePage('artists')} />;

    if (!activeArtist) return noArtistState;

    switch (activePage) {
      case 'overview': return <OverviewPage lang={lang} activeSinger={activeArtist} onNavigate={setActivePage} onOpenTrack={openTrack} />;
      case 'studio': return <StudioPage lang={lang} activeArtist={activeArtist} selectedTrackId={selectedTrackId} onClearSelection={() => setSelectedTrackId(null)} />;
      case 'music': return <MusicBusiness lang={lang} artist={{ id: activeArtist.id, name: activeArtist.name, avatar: activeArtist.avatar }} onBack={() => setActivePage('overview')} />;
      case 'appearance': return <AppearanceForge lang={lang} activeArtist={activeArtist} />;
      case 'wardrobe': return <WardrobePage lang={lang} activeArtist={activeArtist} />;
      case 'distribution': return <DistributionPage lang={lang} activeArtist={activeArtist} />;
      case 'copyright': return <CopyrightPage lang={lang} activeArtist={activeArtist} />;
      case 'community': return <CommunityPage lang={lang} activeArtist={activeArtist} />;
      case 'finance': return <FinancePage lang={lang} activeArtist={activeArtist} />;
      default: return <OverviewPage lang={lang} activeSinger={activeArtist} onNavigate={setActivePage} onOpenTrack={openTrack} />;
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
                    {zh ? ARTIST_TYPE_LABELS[activeArtist.type].zh : ARTIST_TYPE_LABELS[activeArtist.type].en}
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
              <div className="text-[10px] text-gray-600 uppercase tracking-widest font-medium px-3 py-2">{zh ? group.title.zh : group.title.en}</div>
            )}
            <div className="space-y-0.5">
              {group.items.map(item => (
                <SidebarItem
                  key={item.id}
                  icon={getIcon(item)}
                  label={(sidebarOpen || isMobile) ? getSidebarLabel(item) : ''}
                  id={item.id}
                  active={activePage}
                  onClick={(id: string) => { setActivePage(id); if (isMobile) setMobileSidebar(false); }}
                  themeStyles={themeStyles}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom */}
      <div className="px-3 py-3 border-t border-white/5 space-y-1">
        <SidebarItem icon={Settings} label={(sidebarOpen || isMobile) ? (zh ? '设置' : 'Settings') : ''} id="settings" active={activePage} onClick={setActivePage} themeStyles={themeStyles} />
        <button onClick={() => { authLogout(); onLogout(); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${themeStyles.itemBase}`}>
          <LogOut size={18} />
          {(sidebarOpen || isMobile) && <span className="font-medium">{zh ? '退出登录' : 'Log out'}</span>}
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
              <span>{zh ? '搜索...' : 'Search...'}</span>
              <kbd className="text-[10px] bg-white/5 rounded px-1 py-0.5 border border-white/10">⌘K</kbd>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActivePage('finance')}
              title={zh ? '点击查看账单流水' : 'View ledger'}
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
          onNavigate={setActivePage}
          onSwitchArtist={setActiveArtist}
          artists={artists}
        />

        {/* Floating Quick Actions */}
        <FloatingActions lang={lang} onNavigate={setActivePage} />
      </div>
    </div>
  );
};

export default ProducerDashboard;