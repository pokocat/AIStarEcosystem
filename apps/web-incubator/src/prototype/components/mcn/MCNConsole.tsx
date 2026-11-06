import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, Mic2, Music, Disc, Layers, Shield, TrendingUp,
  Globe as GlobeIcon, Wallet, Settings, LogOut, ChevronRight, Plus,
  Play, Pause, BarChart3, Zap, Sparkles, ArrowRight, Crown,
  Heart, Eye, Upload, ChevronDown, Menu, X, ArrowUpRight,
  Headphones, Star, Clock, CheckCircle2, AlertCircle, Rocket, Video,
  Film, ShoppingBag, Tv, Mic, GraduationCap, Gamepad, Award,
  Wand2, Shirt, Grid3X3, ScanFace, Dna, TreePine, Briefcase, ScanLine, Target,
  Store, BadgeCheck, Coins, Link2, Calendar, Building2, Flame,
  FileCheck, Package, Search, Radio, Bell, Factory, Ticket
} from 'lucide-react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";
import { motion, AnimatePresence } from "motion/react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { useTheme, themeConfig } from "../ThemeProvider";
import { ThemeSwitcher } from "../ThemeSwitcher";
import { TRANSLATIONS, type Lang } from "../../translations";
import { MCNMatrix } from "./MCNMatrix";
import { IncubationWizard } from "./IncubationWizard";
import { WardrobePage } from "./WardrobePage";
import { DistributionPage } from "./DistributionPage";
import { CopyrightPage } from "./CopyrightPage";
import { CommunityPage } from "./CommunityPage";
import { FinancePage } from "./FinancePage";
import { SettingsPage } from "./SettingsPage";
import { NotificationPanel } from "./NotificationPanel";
import { CommandPalette } from "./CommandPalette";
import { ArtistRadarCard } from "./ArtistRadarCard";
import {
  MOCK_ARTISTS, ARTIST_TYPE_CONFIG, ARTIST_TYPE_LABELS, DOMAINS_8,
  type Artist, type ArtistType
} from './ArtistTypes';
import { ActivityFeed } from "./ActivityFeed";
import { QuickCreateMenu } from "./FloatingActions";
import { OverviewSkeleton } from "./SkeletonLoader";
import { ArtistMarket } from "../market/ArtistMarket";
import { CelebritySigningCenter } from "../market/CelebritySigningCenter";
import { BillingCenter } from "../billing/BillingCenter";
import { TrainingCenter } from "../training/TrainingCenter";
import { ActivationCodePanel } from "./ActivationCodePanel";
import { FeaturedCelebrities } from "./FeaturedCelebrities";
import { AccountManagementCenter } from "./AccountManagementCenter";
import { ContentCalendar } from "./ContentCalendar";
import { DataAnalytics } from "./DataAnalytics";
import { TrafficBoostCenter } from "./TrafficBoostCenter";
import { ContentReviewWorkbench } from "./ContentReviewWorkbench";
import { BrandAgencyCenter } from "./BrandAgencyCenter";
import { MCNCommissionTool } from "./MCNCommissionTool";
import { CelebrityWorkbench } from "../celebrity/CelebrityWorkbench";
import { BrandPortal } from "../brand/BrandPortal";
import { RoleSwitcherFAB } from "./RoleSwitcherFAB";
import type { PortalRole } from "./RoleSwitcherFAB";
import { LicenseVault } from "./LicenseVault";
import { AssetVault } from "./AssetVault";
import { CopyVault } from "./CopyVault";
import { ClipStudio } from "./ClipStudio";
import { DigitalPersonHub } from "./DigitalPersonHub";
import { PublishPool } from "./PublishPool";
import { WatermarkCenter } from "./WatermarkCenter";
import { StudioWorkbench } from "./StudioWorkbench";
import { ReviewerWorkbench } from "./ReviewerWorkbench";
import { InfringementPatrol } from "./InfringementPatrol";
import { BatchMixStudio } from "./BatchMixStudio";
import { PermissionMatrix } from "./PermissionMatrix";
import { MatrixWorkbench } from "../matrix/MatrixWorkbench";
import { RevenueSplitTool } from "./RevenueSplitTool";
import { ContentPlanningBoard } from "./ContentPlanningBoard";
import { LiveControlRoom } from "../matrix/LiveControlRoom";
import { ContractHub } from "./ContractHub";
import { NotificationCenter } from "../NotificationCenter";
import { ArtistHub } from "./ArtistHub";
import { AssetCenter } from "./AssetCenter";
import { ProductionWorkshop, type WorkshopIntent, type WorkshopTab } from "./ProductionWorkshop";
import { TRACKS } from "./workshopData";
import { PublishCenter } from "./PublishCenter";
import { MonetizationCenter } from "./MonetizationCenter";
import { FanOperations } from "./FanOperations";
import { ComplianceTools } from "./ComplianceTools";
import { getSolutionLabel, type SolutionId } from "../../data/ipPlatform";

const EARNING_DATA = [
  { name: '1月', song: 4000, nft: 2400, tips: 1200 },
  { name: '2月', song: 3000, nft: 1398, tips: 800 },
  { name: '3月', song: 5200, nft: 3800, tips: 2100 },
  { name: '4月', song: 2780, nft: 3908, tips: 1500 },
  { name: '5月', song: 6890, nft: 4800, tips: 3200 },
  { name: '6月', song: 8390, nft: 6300, tips: 4100 },
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
      { id: 'overview', icon: LayoutDashboard, zh: '工作台', en: 'Dashboard' },
    ]
  },
  {
    title: { zh: '我的IP', en: 'My IP' },
    items: [
      { id: 'artist_hub', icon: Users, zh: 'IP孵化中心', en: 'IP Incubation' },
      { id: 'training', icon: GraduationCap, zh: '培训认证', en: 'Training' },
    ]
  },
  {
    title: { zh: '内容制作', en: 'Production' },
    items: [
      { id: 'asset_center', icon: Package, zh: '素材中心', en: 'Asset Center' },
      { id: 'production_workshop', icon: Factory, zh: '制作工坊', en: 'Workshop' },
    ]
  },
  {
    title: { zh: '账号与发布', en: 'Accounts & Publishing' },
    items: [
      { id: 'account_mgmt', icon: Link2, zh: '账号矩阵', en: 'Account Matrix' },
      { id: 'publish_center', icon: Zap, zh: '发布中心', en: 'Publish Center' },
      { id: 'traffic_boost', icon: Flame, zh: '投流管理', en: 'Traffic Boost' },
    ]
  },
  {
    title: { zh: '数据与变现', en: 'Data & Monetization' },
    items: [
      { id: 'analytics', icon: BarChart3, zh: '数据看板', en: 'Analytics' },
      { id: 'monetization_center', icon: Wallet, zh: '变现中心', en: 'Monetization' },
      { id: 'revenue_split', icon: Coins, zh: '收益管理', en: 'Revenue' },
    ]
  },
  {
    title: { zh: '粉丝运营', en: 'Fan Operations' },
    items: [
      { id: 'fan_operations', icon: Heart, zh: '粉丝运营', en: 'Fan Ops' },
    ]
  },
  {
    title: { zh: '合规工具', en: 'Compliance' },
    items: [
      { id: 'compliance_tools', icon: Shield, zh: '授权与审核', en: 'Compliance' },
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

// Status colours for the overview to-do list (urgent → red, today → amber, opportunity → green, account → blue).
const TODO_TONES = { RED: '#ef4444', YLW: '#f59e0b', GRN: '#22c55e', BLU: '#3b82f6' } as const;
// Artist-type accent used for the small avatar badge.
const TYPE_DOT: Record<ArtistType, string> = {
  singer: '#06b6d4', actor: '#a855f7', entertainer: '#ec4899', dancer: '#f59e0b', host: '#22c55e', all_rounder: '#ef4444', idol: '#6366f1',
};

/* ======== Enhanced Overview Page ======== */
const OverviewPage = ({ lang, activeSinger, onNavigate }: {
  lang: Lang;
  activeSinger: Artist;
  onNavigate: (page: string) => void;
}) => {
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

  // Quick launch items for the incubation pipeline
  const QUICK_LAUNCH = [
    {
      step: 0, icon: Target, emoji: 'TGT',
      zh: '孵化新艺人', en: 'New Artist',
      descZh: '设置基础信息与类型', descEn: 'Set name, type & basics',
      accent: '#06b6d4', bg: 'bg-cyan-500/8', border: 'border-cyan-500/20', glow: 'rgba(6,182,212,0.15)',
      featured: false,
    },
    {
      step: 1, icon: ScanFace, emoji: 'SPK',
      zh: 'AI外观锻', en: 'AI Appearance',
      descZh: 'AI对话生成专属形象', descEn: 'Generate look via AI chat',
      accent: '#a855f7', bg: 'bg-purple-500/8', border: 'border-purple-500/25', glow: 'rgba(168,85,247,0.2)',
      featured: true,
    },
    {
      step: 2, icon: Dna, emoji: 'DNA',
      zh: '个性光谱', en: 'Personality',
      descZh: 'MBTI · 情感曲线 · 标签', descEn: 'MBTI · Emotion · Tags',
      accent: '#22c55e', bg: 'bg-green-500/8', border: 'border-green-500/20', glow: 'rgba(34,197,94,0.12)',
      featured: false,
    },
    {
      step: 4, icon: TreePine, emoji: 'TRE',
      zh: '技能树', en: 'Skill Tree',
      descZh: '分配技能点强化天赋', descEn: 'Allocate skill points',
      accent: '#f59e0b', bg: 'bg-amber-500/8', border: 'border-amber-500/20', glow: 'rgba(245,158,11,0.12)',
      featured: false,
    },
    {
      step: 5, icon: Briefcase, emoji: 'BRF',
      zh: '粉丝商业', en: 'Fan Biz',
      descZh: '平台矩阵 · 变现策略', descEn: 'Platforms · Monetization',
      accent: '#ec4899', bg: 'bg-pink-500/8', border: 'border-pink-500/20', glow: 'rgba(236,72,153,0.12)',
      featured: false,
    },
    {
      step: 6, icon: ScanLine, emoji: 'RKT',
      zh: '生成形象卡', en: 'Generate Card',
      descZh: '导出专属赛博朋克卡片', descEn: 'Export cyberpunk card',
      accent: '#ef4444', bg: 'bg-red-500/8', border: 'border-red-500/20', glow: 'rgba(239,68,68,0.12)',
      featured: false,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{t.welcome}</h1>
          <p className="text-gray-400 font-light mt-1">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          {zh ? '运营状态：正常' : 'Operation: Normal'}
        </div>
      </div>

      {/* ── Operation Status Dashboard ── */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Signing Pipeline */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BadgeCheck className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-bold text-gray-900">{zh ? '签约授权进度' : 'Authorization Pipeline'}</span>
            </div>
            <button onClick={() => onNavigate('artist_hub')} className="text-[10px] text-gray-500 hover:text-purple-400 transition flex items-center gap-1">
              {zh ? '管理' : 'Manage'}<ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
            {[
              { name: '于震', status: zh ? '报白审核中' : 'Whitelist Review', pct: 60, color: '#06b6d4', note: zh ? '预计2天通过' : 'Est. 2 days', dot: '#f59e0b' },
              { name: '肖战', status: zh ? '已激活' : 'Activated', pct: 100, color: '#22c55e', note: `GMV ¥128,000`, dot: '#22c55e' },
              { name: '杨幂', status: zh ? '合规审核中' : 'Compliance Review', pct: 40, color: '#a855f7', note: zh ? '橙区内容待审' : 'Orange zone pending', dot: '#a855f7' },
            ].map((item, i) => (
              <div key={item.name} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: item.dot }} />
                    <span className="text-xs font-semibold text-gray-900">{item.name}</span>
                    <span className="text-[9px] text-gray-500">{item.status}</span>
                  </div>
                  <span className="text-[9px] text-gray-600">{item.note}</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${item.pct}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1 }} style={{ background: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Urgent Todos */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-bold text-gray-900">{zh ? '待处理事项' : 'Action Required'}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-bold">5</span>
            </div>
          </div>
          <div className="space-y-2">
            {[
              { icon: 'RED', text: zh ? '2个报白账号待提交材料补充' : '2 whitelist accounts need material supplement', page: 'account_mgmt', urgent: true },
              { icon: 'YLW', text: zh ? '今日3个内容任务待发布' : '3 content tasks to publish today', page: 'calendar', urgent: false },
              { icon: 'YLW', text: zh ? '杨幂合规审核待跟进' : 'Yang Mi compliance review follow-up', page: 'artist_hub', urgent: false },
              { icon: 'GRN', text: zh ? '平台扶持投流：1个视频可接受' : 'Platform grant boost: 1 video eligible', page: 'traffic_boost', urgent: false },
              { icon: 'BLU', text: zh ? 'Pro套餐15天后到期，建议续费' : 'Pro plan expires in 15 days', page: 'billing', urgent: false },
            ].map((todo, i) => (
              <button key={i} onClick={() => onNavigate(todo.page)}
                className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left hover:bg-white/5 transition group">
                <span aria-hidden className="w-2 h-2 rounded-full shrink-0" style={{ background: TODO_TONES[todo.icon as keyof typeof TODO_TONES] ?? '#94a3b8', boxShadow: todo.urgent ? `0 0 0 3px ${TODO_TONES[todo.icon as keyof typeof TODO_TONES]}33` : undefined }} />
                <span className={`text-xs flex-1 ${todo.urgent ? 'text-white' : 'text-gray-400'} group-hover:text-white transition`}>{todo.text}</span>
                <ChevronRight className="w-3 h-3 text-gray-600 group-hover:text-white transition shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Nav to new modules */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { id: 'account_mgmt', icon: Link2, zh: '账号管理', en: 'Accounts', color: '#06b6d4', badge: '5绑定', badgeEn: '5 bound' },
          { id: 'calendar', icon: Calendar, zh: '内容日历', en: 'Calendar', color: '#a855f7', badge: '3待发', badgeEn: '3 pending' },
          { id: 'analytics', icon: BarChart3, zh: '数据看板', en: 'Analytics', color: '#22c55e', badge: '↑18%', badgeEn: '↑18%' },
          { id: 'traffic_boost', icon: Flame, zh: '投流管理', en: 'Boost', color: '#f59e0b', badge: '1活跃', badgeEn: '1 active' },
        ].map((item, i) => {
          const ItemIcon = item.icon;
          return (
          <motion.button key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            onClick={() => onNavigate(item.id)}
            className="flex items-center gap-3 p-3.5 bg-white border border-gray-200 rounded-xl hover:border-white/15 transition group text-left">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${item.color}15` }}>
              <ItemIcon className="w-4.5 h-4.5" style={{ color: item.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-gray-900">{zh ? item.zh : item.en}</div>
              <div className="text-[10px] font-bold mt-0.5" style={{ color: item.color }}>{zh ? item.badge : item.badgeEn}</div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-white transition shrink-0" />
          </motion.button>
          );
        })}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: t.eco_value, value: '¥2.4M', icon: Crown, color: 'text-amber-400', bg: 'bg-amber-500/10', change: '+18.5%' },
          { label: t.rev, value: '¥45.2K', icon: TrendingUp, color: 'text-cyan-400', bg: 'bg-cyan-500/10', change: '+12.3%' },
          { label: t.holders, value: '3,248', icon: Star, color: 'text-purple-400', bg: 'bg-purple-500/10', change: '+248' },
          { label: t.streams, value: '5.8M', icon: Play, color: 'text-pink-400', bg: 'bg-pink-500/10', change: '+1.2M' },
          { label: t.fans, value: '162K', icon: Users, color: 'text-green-400', bg: 'bg-green-500/10', change: '+8.4K' },
        ].map((stat, i) => {
          const StatIcon = stat.icon;
          return (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .08 }}
            className="bg-white border border-gray-200 rounded-xl p-4 hover:border-white/10 transition group">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center`}>
                <StatIcon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <span className="text-xs text-green-400 font-medium">{stat.change}</span>
            </div>
            <div className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{stat.value}</div>
            <div className="text-xs text-gray-500 font-light mt-1">{stat.label}</div>
          </motion.div>
          );
        })}
      </div>

      {/* ── Quick Launch Hub ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2 }}
        className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-purple-500/15 flex items-center justify-center">
              <Wand2 className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <h2 className="text-sm font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              {zh ? 'AI孵化器 — 快速入口' : 'AI Incubator — Quick Launch'}
            </h2>
            <span className="text-[10px] text-gray-600 font-light ml-1">{zh ? '7步流程直达' : '7-step pipeline'}</span>
          </div>
          <button onClick={() => onNavigate('artist_hub')}
            className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-cyan-400 transition">
            {zh ? '前往AI艺人孵化' : 'Go to AI Incubation'} <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {QUICK_LAUNCH.map((item, i) => {
            const ItemIcon = item.icon;
            return (
            <motion.button
              key={item.step}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .25 + i * .05 }}
              onClick={() => onNavigate('incubation')}
              className={`relative group flex flex-col items-start gap-2 p-3 rounded-xl border transition-all duration-300 text-left overflow-hidden
                ${item.featured
                  ? 'bg-purple-500/10 border-purple-500/30 hover:border-purple-400/60 col-span-2 md:col-span-1'
                  : `${item.bg} ${item.border} hover:border-opacity-60`
                }`}
              style={item.featured ? {
                boxShadow: `0 0 20px ${item.glow}`,
              } : undefined}
            >
              {/* Animated shimmer for featured */}
              {item.featured && (
                <motion.div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background: `linear-gradient(135deg, transparent 30%, ${item.glow} 50%, transparent 70%)` }}
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
                />
              )}

              {/* Corner glow dot for featured */}
              {item.featured && (
                <motion.div
                  className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full"
                  style={{ background: item.accent }}
                  animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.2, 0.8] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}

              <div className="flex items-center gap-2 w-full relative z-10">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
                  style={{ background: `${item.accent}20` }}>
                  <ItemIcon className="w-3.5 h-3.5" style={{ color: item.accent }} />
                </div>
                {item.featured && (
                  <span className="text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded-full ml-auto"
                    style={{ background: `${item.accent}25`, color: item.accent }}>
                    {zh ? '热门' : 'HOT'}
                  </span>
                )}
              </div>

              <div className="relative z-10 w-full">
                <div className="text-xs font-semibold text-gray-900 leading-tight group-hover:translate-x-0.5 transition-transform">
                  {zh ? item.zh : item.en}
                </div>
                <div className="text-[10px] text-gray-500 font-light mt-0.5 leading-snug">
                  {zh ? item.descZh : item.descEn}
                </div>
              </div>

              <div className="relative z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[9px] font-mono" style={{ color: item.accent }}>STEP {String(item.step + 1).padStart(2, '0')}</span>
                <ArrowRight className="w-2.5 h-2.5" style={{ color: item.accent }} />
              </div>
            </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Artist Matrix Overview + Type Distribution */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Artist Radar Card - active artist talent overview */}
        <ArtistRadarCard lang={lang} artist={activeSinger} />

        {/* Type distribution pie */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .35 }}
          className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-bold tracking-tight mb-4" style={{ fontFamily: "var(--font-display)" }}>{zh ? '类型分布' : 'Type Distribution'}</h3>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={typeDist} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                  {typeDist.map((entry, i) => <Cell key={`cell-${entry.name}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {typeDist.map((d, i) => (
              <span key={`legend-${d.name}`} className="text-[10px] text-gray-400 flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                {d.name}
              </span>
            ))}
          </div>
        </motion.div>

        {/* 8 Domains overview */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .4 }}
          className="bg-white border border-gray-200 rounded-xl p-6">
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
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-bold tracking-tight mb-4" style={{ fontFamily: "var(--font-display)" }}>{t.chart_title}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={EARNING_DATA}>
              <defs key="defs-1">
                <linearGradient id="overview-colorSong" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="overview-colorNft" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid key="cartesiangrid-2" strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis key="xaxis-3" dataKey="name" stroke="#555" fontSize={12} />
              <YAxis key="yaxis-4" stroke="#555" fontSize={12} />
              <Tooltip key="tooltip-5" contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
              <Area key="area-6" type="monotone" dataKey="song" stroke="#06b6d4" fill="url(#overview-colorSong)" strokeWidth={2} />
              <Area key="area-7" type="monotone" dataKey="nft" stroke="#a855f7" fill="url(#overview-colorNft)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-bold tracking-tight mb-1" style={{ fontFamily: "var(--font-display)" }}>{t.tasks_title}</h3>
          <p className="text-xs text-gray-500 font-light mb-4">{t.tasks_desc}</p>
          <div className="space-y-3">
            {t.tasks.map((task: any, i: number) => {
              const priorities = ['text-red-400 bg-red-500/10', 'text-amber-400 bg-amber-500/10', 'text-cyan-400 bg-cyan-500/10'];
              return (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .3 + i * .1 }}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-3 hover:border-cyan-500/20 transition cursor-pointer group">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      <span className="text-sm font-semibold text-gray-900">{task.t}</span>
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
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{zh ? '近期作品' : 'Recent Tracks'}</h3>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('works')} className="text-cyan-400 hover:bg-cyan-500/10 text-xs">{zh ? '查看全部' : 'View All'} <ChevronRight className="w-3 h-3 ml-1" /></Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {[zh ? '曲名' : 'Title', zh ? '状态' : 'Status', zh ? '播放量' : 'Plays', zh ? '收入' : 'Revenue', zh ? '日期' : 'Date'].map((h, i) => (
                  <th key={i} className="text-left text-xs text-gray-500 font-medium uppercase tracking-wider pb-3 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TRACKS.map((track, i) => (
                <motion.tr key={track.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * .05 }}
                  className="border-b border-gray-100 hover:bg-gray-50 transition cursor-pointer">
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

/* ======== Main Dashboard ======== */
const ProducerDashboard = ({ onLogout, lang, setLang, initialRole = 'operator', initialSolution = 'ecosystem', hideRoleSwitcher = false, onRoleChange }: { onLogout: () => void; lang: Lang; setLang: (l: Lang) => void; initialRole?: PortalRole; initialSolution?: SolutionId; hideRoleSwitcher?: boolean; onRoleChange?: (role: PortalRole) => void }) => {
  const zh = lang === 'zh';
  const { theme } = useTheme();
  const themeStyles = themeConfig[theme].sidebar;
  const [activeArtist, setActiveArtist] = useState<Artist>(MOCK_ARTISTS[0]);
  const [activePage, setActivePageRaw] = useState('overview');
  const [workshopTab, setWorkshopTab] = useState<WorkshopTab>('director');
  const [workshopIntent, setWorkshopIntent] = useState<WorkshopIntent | null>(null);
  // The type workshops (音乐工坊 etc.) are part of the AI Director: legacy 'studio' links open its
  // new-project dialog, 'works' opens its works library. A plain visit clears any pending intent.
  const setActivePage = (page: string) => {
    if (page === 'studio' || page === 'works') {
      setWorkshopTab('director');
      setWorkshopIntent({ kind: page === 'works' ? 'works' : 'new', id: Date.now() });
      setActivePageRaw('production_workshop');
      return;
    }
    if (page === 'production_workshop') { setWorkshopTab('director'); setWorkshopIntent(null); }
    setActivePageRaw(page);
  };
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [showArtistSwitcher, setShowArtistSwitcher] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [portalRole, setPortalRole] = useState<PortalRole>(initialRole);
  // Let the host (global port switcher) mirror role changes made inside the console.
  useEffect(() => {
    if (portalRole !== initialRole) onRoleChange?.(portalRole);
  }, [portalRole]); // eslint-disable-line react-hooks/exhaustive-deps
  const [showIncubationWizard, setShowIncubationWizard] = useState(false);
  const [showActivationCode, setShowActivationCode] = useState(false);

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

  const getIcon = (item: { id: string; icon: any }) => item.icon;

  const handleNavigate = (page: string) => {
    if (page === 'incubation') {
      setShowIncubationWizard(true);
    } else {
      setActivePage(page);
    }
  };

  const renderPage = () => {
    switch (activePage) {
      case 'overview': return <OverviewPage lang={lang} activeSinger={activeArtist} onNavigate={handleNavigate} />;
      case 'artist_hub': return <ArtistHub lang={lang} onNavigateWorkshop={() => setActivePage('studio')} onIncubate={() => setShowIncubationWizard(true)} onGoToTraining={() => setActivePage('training')} />;
      case 'wardrobe': return <WardrobePage lang={lang} activeArtist={activeArtist} />;
      case 'billing': return <BillingCenter lang={lang} />;
      case 'training': return <TrainingCenter lang={lang} />;
      case 'account_mgmt': return <AccountManagementCenter lang={lang} />;
      case 'calendar': return <ContentCalendar lang={lang} />;
      case 'analytics': return <DataAnalytics lang={lang} />;
      case 'traffic_boost': return <TrafficBoostCenter lang={lang} />;
      case 'content_review': return <ContentReviewWorkbench lang={lang} />;
      case 'brand_agency': return <BrandAgencyCenter lang={lang} />;
      case 'mcn_commission': return <MCNCommissionTool lang={lang} />;
      // ── 新增整合页面 ──
      case 'asset_center': return <AssetCenter lang={lang} />;
      case 'production_workshop': return <ProductionWorkshop lang={lang} activeArtist={activeArtist} solutionId={initialSolution} tab={workshopTab} onTabChange={setWorkshopTab} intent={workshopIntent} onOpenPublish={() => setActivePage('publish_center')} />;
      case 'publish_center': return <PublishCenter lang={lang} />;
      case 'monetization_center': return <MonetizationCenter lang={lang} />;
      case 'fan_operations': return <FanOperations lang={lang} />;
      case 'compliance_tools': return <ComplianceTools lang={lang} />;
      case 'distribution': return <DistributionPage lang={lang} activeArtist={activeArtist} />;
      case 'copyright': return <CopyrightPage lang={lang} activeArtist={activeArtist} />;
      case 'community': return <CommunityPage lang={lang} activeArtist={activeArtist} />;
      case 'finance': return <FinancePage lang={lang} activeArtist={activeArtist} />;
      case 'settings': return <SettingsPage lang={lang} setLang={setLang} />;
      // ── P0 新增页面 ──
      case 'license_vault': return <LicenseVault lang={lang} />;
      case 'asset_vault': return <AssetVault lang={lang} />;
      case 'copy_vault': return <CopyVault lang={lang} />;
      case 'clip_studio': return <ClipStudio lang={lang} />;
      case 'digital_person': return <DigitalPersonHub lang={lang} />;
      case 'publish_pool': return <PublishPool lang={lang} />;
      case 'watermark_center': return <WatermarkCenter lang={lang} />;
      case 'infringement_patrol': return <InfringementPatrol lang={lang} />;
      case 'batch_mix': return <BatchMixStudio lang={lang} />;
      case 'permission_matrix': return <PermissionMatrix lang={lang} />;
      case 'revenue_split': return <RevenueSplitTool lang={lang} />;
      case 'content_planning': return <ContentPlanningBoard lang={lang} />;
      case 'live_control': return <LiveControlRoom lang={lang} />;
      case 'contract_hub': return <ContractHub lang={lang} />;
      case 'notifications': return <NotificationCenter lang={lang} />;
      default: return <OverviewPage lang={lang} activeSinger={activeArtist} onNavigate={setActivePage} />;
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
      <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-200">
        <Sparkles className="w-6 h-6 text-cyan-400 shrink-0" />
        {(sidebarOpen || isMobile) && (
          <span className="text-base font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent whitespace-nowrap" style={{ fontFamily: "var(--font-display)" }}>AI Star Eco</span>
        )}
        {isMobile && <button onClick={() => setMobileSidebar(false)} className="ml-auto"><X className="w-5 h-5 text-gray-400" /></button>}
      </div>

      {/* Active artist switcher */}
      {(sidebarOpen || isMobile) && (
        <div className="px-3 py-3 border-b border-gray-200 relative">
          <button onClick={() => setShowArtistSwitcher(!showArtistSwitcher)}
            className="w-full flex items-center gap-3 p-2 rounded-lg bg-gray-50 cursor-pointer hover:bg-gray-100 transition">
            <div className="relative">
              <img src={activeArtist.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-cyan-500/20" />
              <div aria-hidden className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white" style={{ background: TYPE_DOT[activeArtist.type] }} />
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
                className="absolute left-3 right-3 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                {MOCK_ARTISTS.map(artist => {
                  const tc = ARTIST_TYPE_CONFIG[artist.type];
                  return (
                    <button key={artist.id}
                      onClick={() => { setActiveArtist(artist); setShowArtistSwitcher(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition text-left ${artist.id === activeArtist.id ? 'bg-amber-50' : ''}`}>
                      <img src={artist.avatar} alt="" className="w-7 h-7 rounded-full object-cover border border-gray-200" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate">{artist.name}</div>
                        <div className="text-[10px] text-gray-500">{ARTIST_TYPE_LABELS[artist.type][lang]} · Lv.{artist.level}</div>
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
      <div className="px-3 py-3 border-t border-gray-200 space-y-1">
        {(sidebarOpen || isMobile) && <ThemeSwitcher lang={zh ? 'zh' : 'en'} />}
        <SidebarItem icon={Settings} label={(sidebarOpen || isMobile) ? (zh ? '设置' : 'Settings') : ''} id="settings" active={activePage} onClick={setActivePage} themeStyles={themeStyles} />
        <button onClick={onLogout} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${themeStyles.itemBase}`}>
          <LogOut size={18} />
          {(sidebarOpen || isMobile) && <span className="font-medium">{zh ? '返回首页' : 'Back Home'}</span>}
        </button>
      </div>
    </>
  );

  // Role portal overrides — FAB always appended
  if (portalRole === 'celebrity') return (
    <>
      <CelebrityWorkbench lang={lang} onBack={() => setPortalRole('operator')} />
      {!hideRoleSwitcher && <RoleSwitcherFAB currentRole={portalRole} lang={lang} onSwitch={setPortalRole} />}
    </>
  );
  if (portalRole === 'brand') return (
    <>
      <BrandPortal lang={lang} onBack={() => setPortalRole('operator')} />
      {!hideRoleSwitcher && <RoleSwitcherFAB currentRole={portalRole} lang={lang} onSwitch={setPortalRole} />}
    </>
  );
  return (
    <>
    <div className="h-screen w-full flex bg-gray-50 text-gray-900 overflow-hidden" style={{ fontFamily: "var(--font-sans, 'Inter', sans-serif)" }}>
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
        <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-gray-200 bg-white shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <button className="md:hidden" onClick={() => setMobileSidebar(true)}><Menu className="w-5 h-5 text-gray-400" /></button>
            <button className="hidden md:block" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="w-5 h-5 text-gray-400 hover:text-gray-700 transition" />
            </button>
            <div className="text-sm text-gray-500 font-light">{currentPageLabel}</div>
            <div className="hidden lg:flex items-center gap-1.5 rounded-full bg-cyan-50 border border-cyan-200 px-2.5 py-1 text-[10px] text-cyan-700">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
              {getSolutionLabel(initialSolution)[lang]}
            </div>
            <button onClick={() => setShowCommandPalette(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-xs text-gray-500 hover:border-gray-300 hover:text-gray-700 transition ml-2">
              <span>{zh ? '搜索...' : 'Search...'}</span>
              <kbd className="text-[10px] bg-white/5 rounded px-1 py-0.5 border border-white/10">⌘K</kbd>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <QuickCreateMenu lang={lang} onNavigate={handleNavigate} />
            <button
              onClick={() => setShowActivationCode(true)}
              className="relative p-2 rounded-lg hover:bg-gray-100 transition text-gray-400 hover:text-gray-700 group"
              title={zh ? '激活码兑换' : 'Redeem Code'}
            >
              <Ticket className="w-4 h-4" />
              <motion.div
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-purple-500"
                animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </button>
            <div className="relative">
              <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 rounded-lg hover:bg-gray-100 transition text-gray-400 hover:text-gray-700">
                <Bell className="w-4 h-4" />
                <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
              </button>
              <NotificationPanel lang={lang} open={showNotifications} onClose={() => setShowNotifications(false)} />
            </div>
            <div className="flex items-center gap-2 bg-gray-100 rounded-full px-2 py-1">
              <img src={activeArtist.avatar} alt="" className="w-6 h-6 rounded-full object-cover border border-white/10" />
              <span className="text-xs text-gray-400 hidden sm:block">{activeArtist.name}</span>
              <span className="hidden sm:inline text-[10px] text-gray-500">{ARTIST_TYPE_LABELS[activeArtist.type][lang]}</span>
            </div>
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto p-2 pb-24 md:p-4">
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
          onNavigate={handleNavigate}
          onSwitchArtist={setActiveArtist}
        />

        {/* Floating Quick Actions */}
      </div>
    </div>

      {/* Incubation Wizard - Full Screen Overlay */}
      {showIncubationWizard && (
        <div className="fixed inset-0 z-[100] bg-gray-50">
          <IncubationWizard
            lang={lang}
            onClose={() => {
              setShowIncubationWizard(false);
            }}
            onCreated={() => {
              setShowIncubationWizard(false);
              setActivePage('artist_hub');
            }}
            initialStep={0}
            solutionId={initialSolution}
          />
        </div>
      )}

      {/* Activation Code Panel - Modal Only */}
      <ActivationCodePanel
        lang={lang}
        open={showActivationCode}
        onOpenChange={setShowActivationCode}
        hideBanner={true}
      />

      {/* Always-visible role switcher FAB */}
      {!hideRoleSwitcher && <RoleSwitcherFAB currentRole={portalRole} lang={lang} onSwitch={setPortalRole} />}
    </>
  );
};

export default ProducerDashboard;
