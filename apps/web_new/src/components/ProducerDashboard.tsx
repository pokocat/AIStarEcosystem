"use client";

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, Mic2, Music, Disc, Layers, Shield, TrendingUp,
  Globe as GlobeIcon, Wallet, Settings, LogOut, ChevronRight, Plus,
  Play, Pause, BarChart3, Zap, Sparkles, ArrowRight, Crown,
  Heart, Eye, Upload, ChevronDown, Menu, X, ArrowUpRight,
  Headphones, Star, Clock, CheckCircle2, AlertCircle, Rocket, Video,
  Film, ShoppingBag, Tv, Mic, GraduationCap, Gamepad, Award,
  Wand2, Shirt, Grid3X3
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
import { NotificationPanel } from "./producer/NotificationPanel";
import { INITIAL_NOTIFICATIONS } from "@/mocks/notifications";
import type { Notification } from "@/types/notification";
import { Bell } from 'lucide-react';
import { CommandPalette } from "./producer/CommandPalette";
import { ArtistRadarCard } from "./producer/ArtistRadarCard";
import {
  MOCK_ARTISTS, ARTIST_TYPE_CONFIG, ARTIST_TYPE_LABELS, DOMAINS_8,
  type Artist, type ArtistType
} from './producer/ArtistTypes';
import { ActivityFeed } from "./producer/ActivityFeed";
import { FloatingActions } from "./producer/FloatingActions";
import { OverviewSkeleton } from "./producer/SkeletonLoader";

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

/* ======== Studio Page (dynamic by artist type) ======== */
const StudioPage = ({ lang, activeArtist, selectedTrackId, onClearSelection }: { lang: Lang; activeArtist: Artist; selectedTrackId: number | null; onClearSelection: () => void }) => {
  const zh = lang === 'zh';
  const t = TRANSLATIONS[lang].producer.studio;
  const typeConf = ARTIST_TYPE_CONFIG[activeArtist.type];
  const workshopName = zh ? typeConf.workshop.zh : typeConf.workshop.en;
  const selectedTrack = selectedTrackId ? TRACKS.find(t => t.id === selectedTrackId) : null;

  return (
    <div className="space-y-6">
      {selectedTrack && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 rounded-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-lg bg-cyan-500/20 flex items-center justify-center shrink-0">
                <Music className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-bold truncate">{selectedTrack.title}</div>
                <div className="text-xs text-gray-400 mt-1 flex flex-wrap gap-x-3">
                  <span>{zh ? '状态' : 'Status'}: <Badge className={`text-[10px] ml-1 ${
                    selectedTrack.status === 'Published' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                    selectedTrack.status === 'Draft' ? 'bg-gray-500/10 text-gray-400 border-gray-500/20' :
                    'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>{selectedTrack.status}</Badge></span>
                  <span>{zh ? '播放量' : 'Plays'}: <span className="text-white">{selectedTrack.plays}</span></span>
                  <span>{zh ? '收入' : 'Revenue'}: <span className="text-white">{selectedTrack.revenue}</span></span>
                  <span>{zh ? '日期' : 'Date'}: <span className="text-white">{selectedTrack.date}</span></span>
                </div>
              </div>
            </div>
            <button onClick={onClearSelection} className="text-gray-500 hover:text-white transition shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{workshopName}</h1>
          <p className="text-gray-400 font-light mt-1 flex items-center gap-2">
            <span className="text-lg">{typeConf.icon}</span>
            {zh ? `${ARTIST_TYPE_LABELS[activeArtist.type].zh}专属创作工坊` : `${ARTIST_TYPE_LABELS[activeArtist.type].en} Exclusive Workshop`}
          </p>
        </div>
        <Button className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 gap-2"><Sparkles className="w-4 h-4" /> {t.generate_btn}</Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Templates */}
        <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-bold tracking-tight mb-4" style={{ fontFamily: "var(--font-display)" }}>{zh ? '可用模板' : 'Templates'}</h3>
          <div className="space-y-2">
            {(zh ? typeConf.templates.zh : typeConf.templates.en).map((tmpl, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .05 }}
                className="flex items-center justify-between p-3 rounded-lg border border-white/5 hover:border-cyan-500/20 transition cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg ${typeConf.bgColor} flex items-center justify-center`}>
                    <span className="text-sm">{typeConf.icon}</span>
                  </div>
                  <span className="text-sm font-medium">{tmpl}</span>
                </div>
                <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition text-cyan-400 text-xs">
                  {zh ? '使用' : 'Use'} <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Quick gen */}
        <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-bold tracking-tight mb-4" style={{ fontFamily: "var(--font-display)" }}>{t.quick_gen}</h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2 block">{zh ? '内容名称' : 'Content Name'}</label>
              <input className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-cyan-500/40 focus:outline-none transition" placeholder={zh ? '输入名称...' : 'Enter name...'} />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2 block">{zh ? '内容格式' : 'Format'}</label>
              <div className="flex flex-wrap gap-2">
                {(zh ? typeConf.contentFormats.zh : typeConf.contentFormats.en).map(f => (
                  <button key={f} className="px-3 py-1.5 text-xs border border-white/10 rounded-full text-gray-400 hover:border-cyan-500/30 hover:text-cyan-400 transition font-medium">{f}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2 block">{zh ? '创作描述' : 'Description'}</label>
              <textarea className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-cyan-500/40 focus:outline-none transition h-28 resize-none"
                placeholder={zh ? '描述你想创作的内容...' : 'Describe what you want to create...'} />
            </div>
            <Button className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 h-11 gap-2">
              <Sparkles className="w-4 h-4" /> {t.generate_btn}
            </Button>
          </div>
        </div>
      </div>

      {/* Existing tracks */}
      <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
        <h3 className="text-lg font-bold tracking-tight mb-4" style={{ fontFamily: "var(--font-display)" }}>{zh ? '作品列表' : 'Works List'}</h3>
        <div className="space-y-2">
          {TRACKS.map((track, i) => (
            <motion.div key={track.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .05 }}
              className={`flex items-center justify-between p-3 rounded-lg transition cursor-pointer group border ${
                track.id === selectedTrackId
                  ? 'bg-cyan-500/10 border-cyan-500/30'
                  : 'border-transparent hover:bg-white/[0.03] hover:border-white/5'
              }`}>
              <div className="flex items-center gap-3">
                <button className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition">
                  <Play className="w-3.5 h-3.5 text-cyan-400 ml-0.5" />
                </button>
                <div>
                  <div className="text-sm font-semibold">{track.title}</div>
                  <div className="text-xs text-gray-500 font-light">{track.date} · {track.plays} {zh ? '播放' : 'plays'}</div>
                </div>
              </div>
              <Badge className={`text-xs ${
                track.status === 'Published' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                track.status === 'Draft' ? 'bg-gray-500/10 text-gray-400 border-gray-500/20' :
                'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}>{track.status}</Badge>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ======== Main Dashboard ======== */
const ProducerDashboard = ({ onLogout, lang, setLang }: { onLogout: () => void; lang: Lang; setLang: (l: Lang) => void }) => {
  const zh = lang === 'zh';
  const { theme } = useTheme();
  const themeStyles = themeConfig[theme].sidebar;
  const [activeArtist, setActiveArtist] = useState<Artist>(MOCK_ARTISTS[0]);
  const [activePage, setActivePage] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [showArtistSwitcher, setShowArtistSwitcher] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const unreadCount = notifications.filter(n => !n.read).length;
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

  const typeConf = ARTIST_TYPE_CONFIG[activeArtist.type];

  // Dynamic sidebar label for workshop
  const getSidebarLabel = (item: { id: string; zh: string; en: string; dynamicLabel?: boolean }) => {
    if (item.dynamicLabel) {
      return zh ? typeConf.workshop.zh : typeConf.workshop.en;
    }
    return zh ? item.zh : item.en;
  };

  // Dynamic workshop icon
  const getIcon = (item: { id: string; icon: any }) => {
    if (item.id === 'studio') {
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

  const renderPage = () => {
    switch (activePage) {
      case 'overview': return <OverviewPage lang={lang} activeSinger={activeArtist} onNavigate={setActivePage} onOpenTrack={openTrack} />;
      case 'artists': return <MCNMatrix lang={lang} onCreateArtist={() => setActivePage('incubator')} />;
      case 'incubator': return <IncubationWizard lang={lang} onClose={() => setActivePage('artists')} onCreated={() => setActivePage('artists')} />;
      case 'studio': return <StudioPage lang={lang} activeArtist={activeArtist} selectedTrackId={selectedTrackId} onClearSelection={() => setSelectedTrackId(null)} />;
      case 'appearance': return <AppearanceForge lang={lang} activeArtist={activeArtist} />;
      case 'wardrobe': return <WardrobePage lang={lang} activeArtist={activeArtist} />;
      case 'distribution': return <DistributionPage lang={lang} activeArtist={activeArtist} />;
      case 'copyright': return <CopyrightPage lang={lang} activeArtist={activeArtist} />;
      case 'community': return <CommunityPage lang={lang} activeArtist={activeArtist} />;
      case 'finance': return <FinancePage lang={lang} activeArtist={activeArtist} />;
      case 'settings': return <SettingsPage lang={lang} setLang={setLang} />;
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

      {/* Active artist switcher */}
      {(sidebarOpen || isMobile) && (
        <div className="px-3 py-3 border-b border-white/5 relative">
          <button onClick={() => setShowArtistSwitcher(!showArtistSwitcher)}
            className="w-full flex items-center gap-3 p-2 rounded-lg bg-white/[0.03] cursor-pointer hover:bg-white/[0.06] transition">
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
          </button>
          {/* Dropdown */}
          <AnimatePresence>
            {showArtistSwitcher && (
              <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                className="absolute left-3 right-3 top-full mt-1 bg-gray-900 border border-white/10 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                {MOCK_ARTISTS.map(artist => {
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
        <button onClick={onLogout} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${themeStyles.itemBase}`}>
          <LogOut size={18} />
          {(sidebarOpen || isMobile) && <span className="font-medium">{zh ? '返回首页' : 'Back Home'}</span>}
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
            <div className="flex items-center gap-2 bg-white/[0.03] rounded-full px-2 py-1">
              <img src={activeArtist.avatar} alt="" className="w-6 h-6 rounded-full object-cover border border-white/10" />
              <span className="text-xs text-gray-400 hidden sm:block">{activeArtist.name}</span>
              <span className="text-[10px]">{typeConf.icon}</span>
            </div>
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
        />

        {/* Floating Quick Actions */}
        <FloatingActions lang={lang} onNavigate={setActivePage} />
      </div>
    </div>
  );
};

export default ProducerDashboard;