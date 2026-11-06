/**
 * 明星专区 v6.0
 *
 * 双层Tab：已授权/申请授权 + 三种授权类型
 * 支持多账号授权管理
 */

import React, { useState } from 'react';
import {
  Star, ChevronRight, Check, AlertCircle, Sparkles,
  Scissors, Wand2, User, Lock, CheckCircle2, X, ArrowRight,
  GraduationCap, ShoppingCart, Coins, Crown, Zap, Shield,
  Play, Eye, Info, Heart, TrendingUp, Calendar, Users,
  Plus, Package, Clock, BarChart3, Flame
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import type { Lang } from '../../translations';

// ─── 类型定义 ───────────────────────────────────────────────────────────────

type AuthType = 'clip' | 'ai_avatar' | 'digital_human';
type ViewMode = 'authorized' | 'apply';
type FlowStep = 'list' | 'accounts' | 'package' | 'payment' | 'complete';

interface Celebrity {
  id: string;
  name: string;
  avatar: string;
  portrait: string;
  category: string;
  followers: string;
  color: string;
  monthlyRevenue?: string;
  popularity?: string;
  supportedAuth: AuthType[];
}

interface AuthorizedCelebrity extends Celebrity {
  authType: AuthType;
  authorizedAccounts: number; // 已授权账号数
  totalAccounts: number; // 套餐总账号数
  expiryDate: string;
  status: 'active' | 'expiring' | 'expired';
  usageStats: {
    videosUsed: number;
    videosTotal: number;
    lastUsed: string;
  };
}

interface VideoPackage {
  id: string;
  count: number;
  price: number;
  accounts: number; // 支持账号数
  discount?: string;
  recommended?: boolean;
}

interface AIPackage {
  id: string;
  name: string;
  price: number;
  accounts: number;
  features: string[];
  recommended?: boolean;
}

interface TabConfig {
  id: AuthType;
  icon: React.ComponentType<any>;
  labelZh: string;
  labelEn: string;
  descZh: string;
  descEn: string;
  color: string;
  bg: string;
  requiresTraining: boolean;
}

// ─── Mock 数据 ──────────────────────────────────────────────────────────────

const CELEBRITIES: Celebrity[] = [
  {
    id: 'jnl',
    name: '周景行',
    avatar: '/images/star-zhou-jingxing.webp',
    portrait: '/images/star-zhou-jingxing.webp',
    category: '娱乐明星',
    followers: '3200万',
    color: '#f59e0b',
    monthlyRevenue: '¥156K',
    popularity: '985',
    supportedAuth: ['clip', 'ai_avatar', 'digital_human']
  },
  {
    id: 'llq',
    name: '程远山',
    avatar: '/images/star-cheng-yuanshan.webp',
    portrait: '/images/star-cheng-yuanshan.webp',
    category: '影视明星',
    followers: '1800万',
    color: '#06b6d4',
    monthlyRevenue: '¥98K',
    popularity: '876',
    supportedAuth: ['clip', 'ai_avatar']
  },
  {
    id: 'hsw',
    name: '许知遥',
    avatar: '/images/star-xu-zhiyao.webp',
    portrait: '/images/star-xu-zhiyao.webp',
    category: '喜剧明星',
    followers: '1560万',
    color: '#22c55e',
    monthlyRevenue: '¥76K',
    popularity: '845',
    supportedAuth: ['clip']
  },
  {
    id: 'ym',
    name: '苏枝',
    avatar: '/images/star-su-zhi.webp',
    portrait: '/images/star-su-zhi.webp',
    category: '影视明星',
    followers: '8900万',
    color: '#ec4899',
    monthlyRevenue: '¥298K',
    popularity: '1265',
    supportedAuth: ['clip', 'ai_avatar', 'digital_human']
  },
  {
    id: 'xz',
    name: '顾然',
    avatar: '/images/star-gu-ran.webp',
    portrait: '/images/star-gu-ran.webp',
    category: '流量明星',
    followers: '12500万',
    color: '#8b5cf6',
    monthlyRevenue: '¥568K',
    popularity: '1856',
    supportedAuth: ['ai_avatar', 'digital_human']
  },
  {
    id: 'lyf',
    name: '林鹿白',
    avatar: '/images/star-lin-lubai.webp',
    portrait: '/images/star-lin-lubai.webp',
    category: '影视明星',
    followers: '6500万',
    color: '#ec4899',
    monthlyRevenue: '¥425K',
    popularity: '1456',
    supportedAuth: ['ai_avatar', 'digital_human']
  },
];

// Mock已授权明星
const AUTHORIZED_CELEBRITIES: AuthorizedCelebrity[] = [
  {
    ...CELEBRITIES[2], // 陈屿
    id: 'yz',
    name: '陈屿',
    avatar: '/images/star-chen-yu.webp',
    portrait: '/images/star-chen-yu.webp',
    category: '影视明星',
    followers: '980万',
    color: '#a855f7',
    monthlyRevenue: '¥128K',
    popularity: '923',
    supportedAuth: ['clip', 'ai_avatar', 'digital_human'],
    authType: 'clip',
    authorizedAccounts: 2,
    totalAccounts: 3,
    expiryDate: '2026-08-15',
    status: 'active',
    usageStats: {
      videosUsed: 35,
      videosTotal: 100,
      lastUsed: '2026-05-16'
    }
  }
];

const AUTH_TABS: TabConfig[] = [
  {
    id: 'clip',
    icon: Scissors,
    labelZh: '切片带货',
    labelEn: 'Clip Auth',
    descZh: '真实素材切片',
    descEn: 'Real clips',
    color: '#06b6d4',
    bg: 'bg-cyan-500/10',
    requiresTraining: true,
  },
  {
    id: 'ai_avatar',
    icon: Wand2,
    labelZh: 'AI形象',
    labelEn: 'AI Avatar',
    descZh: 'AI生成形象',
    descEn: 'AI avatar',
    color: '#a855f7',
    bg: 'bg-purple-500/10',
    requiresTraining: false,
  },
  {
    id: 'digital_human',
    icon: User,
    labelZh: 'AI数字人',
    labelEn: 'Digital Human',
    descZh: '数字分身',
    descEn: 'Digital twin',
    color: '#f59e0b',
    bg: 'bg-amber-500/10',
    requiresTraining: false,
  },
];

const VIDEO_PACKAGES: VideoPackage[] = [
  { id: 'pack_50', count: 50, price: 9800, accounts: 1 },
  { id: 'pack_100', count: 100, price: 16800, accounts: 3, discount: '15%优惠', recommended: true },
  { id: 'pack_200', count: 200, price: 29800, accounts: 5, discount: '25%优惠' },
];

const AI_AVATAR_PACKAGES: AIPackage[] = [
  { id: 'avatar_basic', name: '基础版', price: 12800, accounts: 1, features: ['静态形象生成', '3种表情包', '单场景应用'] },
  { id: 'avatar_pro', name: '专业版', price: 28800, accounts: 3, features: ['动态形象生成', '10种表情动作', '多场景应用', 'AI配音'], recommended: true },
  { id: 'avatar_elite', name: '旗舰版', price: 58800, accounts: 5, features: ['高清形象生成', '无限表情动作', '全场景应用', 'AI配音', '独家定制'] },
];

const DIGITAL_HUMAN_PACKAGES: AIPackage[] = [
  { id: 'dh_basic', name: '基础版', price: 38800, accounts: 1, features: ['数字人形象', '声音克隆', '基础动作', '单机位'] },
  { id: 'dh_pro', name: '专业版', price: 78800, accounts: 3, features: ['高清数字人', '声音克隆', '丰富动作库', '多机位', '实时驱动'], recommended: true },
  { id: 'dh_elite', name: '旗舰版', price: 158000, accounts: 5, features: ['超写实数字人', '完整声音库', '全动作捕捉', '无限机位', '实时交互', '独家定制'] },
];

// ─── 主组件 ─────────────────────────────────────────────────────────────────

export const CelebritySigningCenter = ({ lang, onGoToTraining }: { lang: Lang; onGoToTraining?: () => void }) => {
  const zh = lang === 'zh';

  const [viewMode, setViewMode] = useState<ViewMode>('apply');
  const [activeAuthTab, setActiveAuthTab] = useState<AuthType>('clip');
  const [flowStep, setFlowStep] = useState<FlowStep>('list');
  const [selectedCelebrity, setSelectedCelebrity] = useState<Celebrity | null>(null);
  const [selectedAccountCount, setSelectedAccountCount] = useState<number>(1);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);

  // 过滤当前Tab支持的明星
  const filteredCelebrities = viewMode === 'apply'
    ? CELEBRITIES.filter(c => c.supportedAuth.includes(activeAuthTab))
    : AUTHORIZED_CELEBRITIES.filter(c => c.authType === activeAuthTab);

  // 点击明星卡片
  const handleCelebrityClick = (celeb: Celebrity | AuthorizedCelebrity) => {
    if (viewMode === 'authorized') {
      // 查看已授权详情
      return;
    }
    setSelectedCelebrity(celeb);
    setFlowStep('accounts');
  };

  // 完成支付
  const handlePayment = () => {
    setFlowStep('complete');
  };

  // 重置流程
  const resetFlow = () => {
    setFlowStep('list');
    setSelectedCelebrity(null);
    setSelectedAccountCount(1);
    setSelectedPackage(null);
  };

  // 切换Tab时重置流程
  const handleTabChange = (authType: AuthType) => {
    setActiveAuthTab(authType);
    resetFlow();
  };

  // 切换视图模式时重置
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    resetFlow();
  };

  const currentTabConfig = AUTH_TABS.find(t => t.id === activeAuthTab)!;

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header with Tabs */}
      <div className="shrink-0 border-b border-white/5 bg-gray-900/30 backdrop-blur-xl">
        <div className="px-6 py-4">

          {/* Combined View Mode + Auth Type Tabs */}
          <div className="flex items-center justify-between gap-4 pb-2">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleViewModeChange('apply')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  viewMode === 'apply'
                    ? 'bg-white/10 text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>{zh ? '申请授权' : 'Apply Auth'}</span>
                </div>
              </button>
              <button
                onClick={() => handleViewModeChange('authorized')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  viewMode === 'authorized'
                    ? 'bg-white/10 text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{zh ? '已授权' : 'Authorized'}</span>
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] px-1.5 py-0">
                    {AUTHORIZED_CELEBRITIES.length}
                  </Badge>
                </div>
              </button>
            </div>

            {/* Auth Type Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto flex-1">
              {AUTH_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeAuthTab === tab.id;
                const count = viewMode === 'apply'
                  ? CELEBRITIES.filter(c => c.supportedAuth.includes(tab.id)).length
                  : AUTHORIZED_CELEBRITIES.filter(c => c.authType === tab.id).length;

                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`
                      relative flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
                      transition-all whitespace-nowrap
                      ${isActive
                        ? 'bg-white/10 text-white shadow-lg'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }
                    `}
                    style={isActive ? {
                      boxShadow: `0 0 20px ${tab.color}40`,
                      border: `1px solid ${tab.color}30`,
                    } : undefined}
                  >
                    <Icon
                      className="w-3.5 h-3.5"
                      style={{ color: isActive ? tab.color : undefined }}
                    />
                    <span className="hidden sm:inline">{zh ? tab.labelZh : tab.labelEn}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-white/5'} text-gray-400`}>
                      {count}
                    </span>
                    {tab.requiresTraining && isActive && viewMode === 'apply' && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white">
                        需培训
                      </span>
                    )}
                    {isActive && (
                      <motion.div
                        layoutId="activeAuthTab"
                        className="absolute inset-0 rounded-xl -z-10"
                        style={{ background: tab.bg }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* 明星列表 */}
        {flowStep === 'list' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                {viewMode === 'apply'
                  ? (zh ? `${currentTabConfig.labelZh}授权` : currentTabConfig.labelEn)
                  : (zh ? '我的授权明星' : 'My Authorized Celebrities')
                }
              </h2>
              <p className="text-xs text-gray-500">
                {viewMode === 'apply'
                  ? (zh ? '点击明星卡片开始授权申请' : 'Click celebrity to start authorization')
                  : (zh ? '查看授权详情和使用情况' : 'View auth details and usage')
                }
              </p>
            </div>

            {filteredCelebrities.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 mx-auto rounded-full bg-gray-800/50 flex items-center justify-center mb-4">
                  <Star className="w-8 h-8 text-gray-600" />
                </div>
                <p className="text-gray-500">
                  {viewMode === 'apply'
                    ? (zh ? '暂无支持该授权类型的明星' : 'No celebrities available')
                    : (zh ? '暂无已授权明星' : 'No authorized celebrities')
                  }
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredCelebrities.map((celeb, i) => {
                  const isAuthorized = 'authType' in celeb;
                  const authCeleb = isAuthorized ? celeb as AuthorizedCelebrity : null;

                  return (
                    <motion.div
                      key={celeb.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => handleCelebrityClick(celeb)}
                      className="relative rounded-xl overflow-hidden border border-white/5 bg-gray-900/60 cursor-pointer group hover:ring-2 hover:border-transparent transition-all flex flex-col"
                      style={{ '--hover-ring-color': celeb.color + '40' } as any}
                      onMouseEnter={(e) => e.currentTarget.style.setProperty('--tw-ring-color', celeb.color + '40')}
                    >
                      {/* ===== Layer 1: Portrait hero ===== */}
                      <div className="relative aspect-[4/5] overflow-hidden bg-black flex-shrink-0">
                        <img
                          src={celeb.portrait}
                          alt={celeb.name}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black via-black/60 to-transparent" />
                        <div
                          className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b opacity-30 mix-blend-overlay pointer-events-none"
                          style={{ background: `linear-gradient(to bottom, ${celeb.color}33, transparent)` }}
                        />

                        {/* Top-right: status badge */}
                        <div className="absolute top-3 right-3">
                          {isAuthorized && authCeleb ? (
                            <Badge className={`backdrop-blur-md text-[9px] flex items-center gap-1 px-2 py-0.5 ${
                              authCeleb.status === 'active' ? 'bg-green-500/20 border-green-500/40 text-green-300' :
                              authCeleb.status === 'expiring' ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' :
                              'bg-red-500/20 border-red-500/40 text-red-300'
                            }`}>
                              <motion.span className="w-1.5 h-1.5 rounded-full bg-green-400" animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.6, repeat: Infinity }} />
                              {zh ? '已授权' : 'Active'}
                            </Badge>
                          ) : (
                            <Badge className="backdrop-blur-md text-[9px] flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 border-blue-500/40 text-blue-300">
                              <Lock className="w-3 h-3" />
                              {zh ? '未授权' : 'Locked'}
                            </Badge>
                          )}
                        </div>

                        {/* Bottom: name + category tag */}
                        <div className="absolute inset-x-0 bottom-0 p-3.5">
                          <div className="flex items-end justify-between gap-2 mb-1.5">
                            <h3 className="text-white truncate" style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.01em', textShadow: '0 2px 8px rgba(0,0,0,.6)' }}>
                              {celeb.name}
                            </h3>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <span
                              style={{ background: celeb.color + '25', color: celeb.color, borderColor: celeb.color + '40' }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border backdrop-blur-sm">
                              <Star className="w-3 h-3" />
                              <span>#{celeb.category}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* ===== Apply Mode ===== */}
                      {viewMode === 'apply' ? (
                        <>
                          {/* Layer 2: Key metrics 2x2 */}
                          <div className="grid grid-cols-2 gap-px bg-white/5 border-t border-white/5">
                            <div className="bg-gray-950/80 px-3 py-2.5 flex items-center gap-2">
                              <Heart className="w-3.5 h-3.5 text-rose-400 shrink-0 fill-current" />
                              <div className="min-w-0">
                                <div className="text-[9px] text-gray-500 uppercase tracking-wider">{zh ? '粉丝' : 'Fans'}</div>
                                <div className="text-xs font-bold tabular-nums truncate text-rose-300" style={{ fontFamily: 'var(--font-display)' }}>{celeb.followers}</div>
                              </div>
                            </div>
                            <div className="bg-gray-950/80 px-3 py-2.5 flex items-center gap-2">
                              <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                              <div className="min-w-0">
                                <div className="text-[9px] text-gray-500 uppercase tracking-wider">{zh ? '人气' : 'Pop'}</div>
                                <div className="text-xs font-bold tabular-nums text-orange-300" style={{ fontFamily: 'var(--font-display)' }}>{celeb.popularity}</div>
                              </div>
                            </div>
                            <div className="bg-gray-950/80 px-3 py-2.5 flex items-center gap-2 col-span-2">
                              <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="text-[9px] text-gray-500 uppercase tracking-wider">{zh ? '预估月收益' : 'Est. Monthly'}</div>
                                <div className="text-xs font-bold tabular-nums truncate bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent" style={{ fontFamily: 'var(--font-display)' }}>{celeb.monthlyRevenue}</div>
                              </div>
                            </div>
                          </div>

                          {/* Layer 3: Supported auth types matrix */}
                          <div className="grid grid-cols-3 gap-px bg-white/5">
                            {AUTH_TABS.map(authTab => {
                              const isSupported = celeb.supportedAuth.includes(authTab.id);
                              const Icon = authTab.icon;
                              return (
                                <div
                                  key={authTab.id}
                                  className={`bg-gray-950/80 px-2 py-2 flex flex-col items-center gap-0.5 ${isSupported ? 'opacity-100' : 'opacity-30'}`}
                                >
                                  <Icon className="w-3.5 h-3.5 opacity-70" style={{ color: isSupported ? authTab.color : '#6b7280' }} />
                                  <span className="text-[9px] text-gray-400 leading-none text-center">{zh ? authTab.labelZh : authTab.labelEn}</span>
                                  {isSupported && <CheckCircle2 className="w-2.5 h-2.5 text-green-400 mt-0.5" />}
                                </div>
                              );
                            })}
                          </div>

                          {/* Layer 4: Influence value progress */}
                          {(() => {
                            const influence = parseInt(celeb.popularity || '0');
                            const maxInfluence = Math.max(...CELEBRITIES.map(c => parseInt(c.popularity || '0')));
                            const pct = maxInfluence > 0 ? Math.min(100, (influence / maxInfluence) * 100) : 0;
                            const isTop = influence === maxInfluence && influence > 0;

                            return (
                              <div className="relative px-3.5 py-2.5 bg-gray-950/80 border-t border-white/5">
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <Crown className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                                    <span className="text-[10px] uppercase tracking-wider text-gray-300">{zh ? '影响力指数' : 'Influence'}</span>
                                    {isTop && <Badge className="text-[9px] bg-amber-500/15 text-amber-300 border-amber-500/30 px-1.5 py-0">TOP</Badge>}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className="text-sm font-extrabold tabular-nums text-amber-400" style={{ fontFamily: 'var(--font-display)' }}>{celeb.popularity}</span>
                                    <ArrowRight className="w-3.5 h-3.5 text-amber-400 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition" />
                                  </div>
                                </div>
                                <div className="relative h-1.5 rounded-full bg-white/5 overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pct}%` }}
                                    transition={{ duration: 0.8, delay: i * 0.03 }}
                                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-500/30 via-orange-500/20 to-amber-500/30"
                                  />
                                  <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, boxShadow: '0 0 8px rgba(245,158,11,0.4)' }} />
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      ) : authCeleb && (
                        <>
                          {/* ===== Authorized Mode ===== */}
                          {/* Layer 2: Key metrics 2x2 */}
                          <div className="grid grid-cols-2 gap-px bg-white/5 border-t border-white/5">
                            <div className="bg-gray-950/80 px-3 py-2.5 flex items-center gap-2">
                              <Users className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                              <div className="min-w-0">
                                <div className="text-[9px] text-gray-500 uppercase tracking-wider">{zh ? '授权账号' : 'Accounts'}</div>
                                <div className="text-xs font-bold tabular-nums text-purple-300" style={{ fontFamily: 'var(--font-display)' }}>
                                  {authCeleb.authorizedAccounts}/{authCeleb.totalAccounts}
                                </div>
                              </div>
                            </div>
                            <div className="bg-gray-950/80 px-3 py-2.5 flex items-center gap-2">
                              <Play className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              <div className="min-w-0">
                                <div className="text-[9px] text-gray-500 uppercase tracking-wider">{zh ? '视频使用' : 'Videos'}</div>
                                <div className="text-xs font-bold tabular-nums text-cyan-300" style={{ fontFamily: 'var(--font-display)' }}>
                                  {authCeleb.usageStats.videosUsed}/{authCeleb.usageStats.videosTotal}
                                </div>
                              </div>
                            </div>
                            <div className="bg-gray-950/80 px-3 py-2.5 flex items-center gap-2 col-span-2">
                              <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="text-[9px] text-gray-500 uppercase tracking-wider">{zh ? '到期时间' : 'Expires'}</div>
                                <div className="text-xs font-bold text-emerald-300" style={{ fontFamily: 'var(--font-display)' }}>{authCeleb.expiryDate}</div>
                              </div>
                            </div>
                          </div>

                          {/* Layer 3: Current auth type display */}
                          <div className="grid grid-cols-3 gap-px bg-white/5">
                            {AUTH_TABS.map(authTab => {
                              const isCurrentAuth = authCeleb.authType === authTab.id;
                              const Icon = authTab.icon;
                              return (
                                <div
                                  key={authTab.id}
                                  className={`bg-gray-950/80 px-2 py-2 flex flex-col items-center gap-0.5 ${isCurrentAuth ? 'opacity-100' : 'opacity-30'}`}
                                >
                                  <Icon className="w-3.5 h-3.5 opacity-70" style={{ color: isCurrentAuth ? authTab.color : '#6b7280' }} />
                                  <span className="text-[9px] text-gray-400 leading-none text-center">{zh ? authTab.labelZh : authTab.labelEn}</span>
                                  {isCurrentAuth && <CheckCircle2 className="w-2.5 h-2.5 text-green-400 mt-0.5" />}
                                </div>
                              );
                            })}
                          </div>

                          {/* Layer 4: Progress bars */}
                          <div className="relative px-3.5 py-2.5 bg-gray-950/80 border-t border-white/5">
                            <div className="space-y-2">
                              {/* Accounts progress */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] uppercase tracking-wider text-gray-400">{zh ? '账号进度' : 'Account Progress'}</span>
                                  <span className="text-[10px] text-purple-400 font-bold">{Math.round((authCeleb.authorizedAccounts / authCeleb.totalAccounts) * 100)}%</span>
                                </div>
                                <div className="relative h-1.5 rounded-full bg-white/5 overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(authCeleb.authorizedAccounts / authCeleb.totalAccounts) * 100}%` }}
                                    transition={{ duration: 0.8, delay: i * 0.03 }}
                                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-purple-500/30 via-fuchsia-500/20 to-purple-500/30"
                                  />
                                  <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(authCeleb.authorizedAccounts / authCeleb.totalAccounts) * 100}%`, boxShadow: '0 0 8px rgba(168,85,247,0.4)' }} />
                                </div>
                              </div>
                              {/* Videos progress */}
                              {authCeleb.authType === 'clip' && (
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] uppercase tracking-wider text-gray-400">{zh ? '视频进度' : 'Video Progress'}</span>
                                    <span className="text-[10px] text-cyan-400 font-bold">{Math.round((authCeleb.usageStats.videosUsed / authCeleb.usageStats.videosTotal) * 100)}%</span>
                                  </div>
                                  <div className="relative h-1.5 rounded-full bg-white/5 overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${(authCeleb.usageStats.videosUsed / authCeleb.usageStats.videosTotal) * 100}%` }}
                                      transition={{ duration: 0.8, delay: i * 0.03 + 0.1 }}
                                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-500/30 via-blue-500/20 to-cyan-500/30"
                                    />
                                    <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(authCeleb.usageStats.videosUsed / authCeleb.usageStats.videosTotal) * 100}%`, boxShadow: '0 0 8px rgba(6,182,212,0.4)' }} />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 选择授权账号数 */}
        {flowStep === 'accounts' && selectedCelebrity && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
              <button onClick={resetFlow} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition">
                <X className="w-4 h-4 text-gray-400" />
              </button>
              <img src={selectedCelebrity.avatar} alt={selectedCelebrity.name} className="w-10 h-10 rounded-full" />
              <div>
                <h2 className="text-lg font-bold text-white">{selectedCelebrity.name}</h2>
                <p className="text-xs text-gray-500">{zh ? currentTabConfig.labelZh : currentTabConfig.labelEn}</p>
              </div>
            </div>

            <div className="p-6 rounded-xl border border-white/10 bg-gray-900/50">
              <h3 className="text-sm font-bold text-white mb-4">{zh ? '需要授权多少个账号？' : 'How many accounts to authorize?'}</h3>

              <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-6">
                {[1, 2, 3, 5, 10].map((count) => (
                  <button
                    key={count}
                    onClick={() => setSelectedAccountCount(count)}
                    className={`p-4 rounded-xl border transition-all ${
                      selectedAccountCount === count
                        ? 'border-cyan-500 bg-cyan-500/10 ring-2 ring-cyan-500/40'
                        : 'border-white/10 bg-gray-900/50 hover:border-white/30'
                    }`}
                  >
                    <div className="text-center">
                      <Users className={`w-5 h-5 mx-auto mb-1 ${selectedAccountCount === count ? 'text-cyan-400' : 'text-gray-500'}`} />
                      <div className="text-lg font-bold text-white">{count}</div>
                      <div className="text-[9px] text-gray-500">{zh ? '个账号' : 'accounts'}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <div className="flex items-start gap-3">
                  <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-gray-400">
                    {zh ? `已选择 ${selectedAccountCount} 个账号授权。不同套餐包含的账号数不同，请在下一步选择合适的套餐。` : `Selected ${selectedAccountCount} accounts. Different packages include different account quotas.`}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => setFlowStep('package')}
                className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:opacity-90 text-white"
              >
                {zh ? '下一步：选择套餐' : 'Next: Select Package'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* 套餐选择 */}
        {flowStep === 'package' && selectedCelebrity && (
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => setFlowStep('accounts')} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition">
                  <ChevronRight className="w-4 h-4 text-gray-400 rotate-180" />
                </button>
                <img src={selectedCelebrity.avatar} alt={selectedCelebrity.name} className="w-10 h-10 rounded-full" />
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedCelebrity.name}</h2>
                  <p className="text-xs text-gray-500">
                    {zh ? currentTabConfig.labelZh : currentTabConfig.labelEn} · {selectedAccountCount} {zh ? '个账号' : 'accounts'}
                  </p>
                </div>
              </div>
            </div>

            {activeAuthTab === 'clip' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
                  <div className="flex items-start gap-3">
                    <GraduationCap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1 text-sm">
                      <div className="font-bold text-white mb-1">{zh ? '套餐包含培训认证资格' : 'Package Includes Training Certification'}</div>
                      <div className="text-xs text-gray-400 space-y-1">
                        <div>{zh ? '• 购买后解锁专属培训课程（约30分钟）' : '• Unlock exclusive training course (~30 min)'}</div>
                        <div>{zh ? '• 在线考试80分通过，获得永久证书' : '• Pass exam with 80%, get permanent certificate'}</div>
                        <div>{zh ? '• 完成培训后即可使用切片素材' : '• Use clips after completing training'}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white mb-3">{zh ? '选择视频数量套餐' : 'Select Video Package'}</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    {VIDEO_PACKAGES.map((pkg) => {
                      const meetsAccountRequirement = pkg.accounts >= selectedAccountCount;
                      return (
                        <button
                          key={pkg.id}
                          onClick={() => meetsAccountRequirement && setSelectedPackage(pkg.id)}
                          disabled={!meetsAccountRequirement}
                          className={`relative p-5 rounded-xl border transition-all ${
                            !meetsAccountRequirement
                              ? 'opacity-40 cursor-not-allowed border-white/5'
                              : selectedPackage === pkg.id
                                ? 'border-cyan-500 bg-cyan-500/10 ring-2 ring-cyan-500/40'
                                : 'border-white/10 bg-gray-900/50 hover:border-white/30'
                          }`}
                        >
                          {pkg.recommended && meetsAccountRequirement && (
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                              <div className="px-2 py-0.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 text-[9px] font-bold text-white">
                                {zh ? '推荐' : 'Recommended'}
                              </div>
                            </div>
                          )}
                          <div className="text-center space-y-2">
                            <div className="text-3xl font-bold text-white">{pkg.count}</div>
                            <div className="text-[10px] text-gray-500">{zh ? '条视频素材' : 'Video Clips'}</div>
                            <div className="text-lg font-bold text-cyan-400">¥{pkg.price.toLocaleString()}</div>
                            {pkg.discount && (
                              <div className="text-[10px] text-green-400">{pkg.discount}</div>
                            )}
                            <div className="flex items-center justify-center gap-1 text-[9px] text-gray-600 pt-1">
                              <Users className="w-3 h-3" />
                              <span>{zh ? `支持${pkg.accounts}个账号` : `${pkg.accounts} accounts`}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeAuthTab === 'ai_avatar' && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white">{zh ? '选择AI形象套餐' : 'Select AI Avatar Package'}</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  {AI_AVATAR_PACKAGES.map((pkg) => {
                    const meetsAccountRequirement = pkg.accounts >= selectedAccountCount;
                    return (
                      <button
                        key={pkg.id}
                        onClick={() => meetsAccountRequirement && setSelectedPackage(pkg.id)}
                        disabled={!meetsAccountRequirement}
                        className={`relative p-5 rounded-xl border transition-all ${
                          !meetsAccountRequirement
                            ? 'opacity-40 cursor-not-allowed border-white/5'
                            : selectedPackage === pkg.id
                              ? 'border-purple-500 bg-purple-500/10 ring-2 ring-purple-500/40'
                              : 'border-white/10 bg-gray-900/50 hover:border-white/30'
                        }`}
                      >
                        {pkg.recommended && meetsAccountRequirement && (
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                            <div className="px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-[9px] font-bold text-white">
                              {zh ? '推荐' : 'Recommended'}
                            </div>
                          </div>
                        )}
                        <div className="space-y-3">
                          <div>
                            <div className="text-lg font-bold text-white">{pkg.name}</div>
                            <div className="text-xl font-bold text-purple-400 mt-1">¥{pkg.price.toLocaleString()}</div>
                          </div>
                          <div className="space-y-1.5">
                            {pkg.features.map((feature, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
                                <Check className="w-3 h-3 text-purple-400 shrink-0" />
                                <span>{feature}</span>
                              </div>
                            ))}
                          </div>
                          <div className="pt-2 border-t border-white/10">
                            <div className="flex items-center justify-center gap-1 text-[9px] text-gray-600">
                              <Users className="w-3 h-3" />
                              <span>{zh ? `支持${pkg.accounts}个账号` : `${pkg.accounts} accounts`}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeAuthTab === 'digital_human' && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white">{zh ? '选择数字人套餐' : 'Select Digital Human Package'}</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  {DIGITAL_HUMAN_PACKAGES.map((pkg) => {
                    const meetsAccountRequirement = pkg.accounts >= selectedAccountCount;
                    return (
                      <button
                        key={pkg.id}
                        onClick={() => meetsAccountRequirement && setSelectedPackage(pkg.id)}
                        disabled={!meetsAccountRequirement}
                        className={`relative p-5 rounded-xl border transition-all ${
                          !meetsAccountRequirement
                            ? 'opacity-40 cursor-not-allowed border-white/5'
                            : selectedPackage === pkg.id
                              ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/40'
                              : 'border-white/10 bg-gray-900/50 hover:border-white/30'
                        }`}
                      >
                        {pkg.recommended && meetsAccountRequirement && (
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                            <div className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-[9px] font-bold text-white">
                              {zh ? '推荐' : 'Recommended'}
                            </div>
                          </div>
                        )}
                        <div className="space-y-3">
                          <div>
                            <div className="text-lg font-bold text-white">{pkg.name}</div>
                            <div className="text-xl font-bold text-amber-400 mt-1">¥{pkg.price.toLocaleString()}</div>
                          </div>
                          <div className="space-y-1.5">
                            {pkg.features.map((feature, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
                                <Check className="w-3 h-3 text-amber-400 shrink-0" />
                                <span>{feature}</span>
                              </div>
                            ))}
                          </div>
                          <div className="pt-2 border-t border-white/10">
                            <div className="flex items-center justify-center gap-1 text-[9px] text-gray-600">
                              <Users className="w-3 h-3" />
                              <span>{zh ? `支持${pkg.accounts}个账号` : `${pkg.accounts} accounts`}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedPackage && (
              <div className="flex justify-end pt-4">
                <Button
                  onClick={() => setFlowStep('payment')}
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:opacity-90 text-white"
                >
                  {zh ? '前往支付' : 'Proceed to Payment'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* 支付确认 */}
        {flowStep === 'payment' && selectedCelebrity && selectedPackage && (
          <div className="max-w-2xl mx-auto">
            <div className="p-6 rounded-xl border border-white/10 bg-gray-900/50 space-y-4">
              <h3 className="text-lg font-bold text-white">{zh ? '确认订单' : 'Confirm Order'}</h3>

              <div className="space-y-3 py-4 border-y border-white/10">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">{zh ? '明星' : 'Celebrity'}</span>
                  <div className="flex items-center gap-2">
                    <img src={selectedCelebrity.avatar} alt={selectedCelebrity.name} className="w-6 h-6 rounded-full" />
                    <span className="text-white font-medium">{selectedCelebrity.name}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">{zh ? '授权类型' : 'Auth Type'}</span>
                  <span className="text-white font-medium">
                    {zh ? currentTabConfig.labelZh : currentTabConfig.labelEn}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">{zh ? '授权账号数' : 'Accounts'}</span>
                  <span className="text-white font-medium">{selectedAccountCount} {zh ? '个' : ''}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">{zh ? '套餐' : 'Package'}</span>
                  <span className="text-white font-medium">
                    {activeAuthTab === 'clip' && VIDEO_PACKAGES.find(p => p.id === selectedPackage)?.count + (zh ? '条视频' : ' videos')}
                    {activeAuthTab === 'ai_avatar' && AI_AVATAR_PACKAGES.find(p => p.id === selectedPackage)?.name}
                    {activeAuthTab === 'digital_human' && DIGITAL_HUMAN_PACKAGES.find(p => p.id === selectedPackage)?.name}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                <span className="text-lg font-bold text-white">{zh ? '总计' : 'Total'}</span>
                <span className="text-2xl font-bold text-cyan-400">
                  ¥{(
                    activeAuthTab === 'clip' ? VIDEO_PACKAGES.find(p => p.id === selectedPackage)?.price :
                    activeAuthTab === 'ai_avatar' ? AI_AVATAR_PACKAGES.find(p => p.id === selectedPackage)?.price :
                    DIGITAL_HUMAN_PACKAGES.find(p => p.id === selectedPackage)?.price
                  )?.toLocaleString()}
                </span>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setFlowStep('package')} className="flex-1 border-white/20 text-gray-400">
                  {zh ? '返回修改' : 'Back'}
                </Button>
                <Button onClick={handlePayment} className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:opacity-90 text-white">
                  <Coins className="w-4 h-4 mr-2" />
                  {zh ? '确认支付' : 'Confirm Payment'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 完成 */}
        {flowStep === 'complete' && selectedCelebrity && (
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-green-500/20 to-cyan-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">{zh ? '购买成功！' : 'Purchase Complete!'}</h3>
              <p className="text-sm text-gray-400">
                {zh ? `您已成功购买 ${selectedCelebrity.name} 的${currentTabConfig.labelZh}授权` : `Successfully purchased ${selectedCelebrity.name}'s ${currentTabConfig.labelEn}`}
              </p>
            </div>

            {activeAuthTab === 'clip' && (
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-left">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div className="font-bold text-white text-sm">{zh ? '下一步：完成培训认证' : 'Next: Complete Training'}</div>
                    <div className="text-xs text-gray-400 space-y-1">
                      <div>{zh ? '1. 前往「培训认证」页面开始学习' : '1. Go to Training page to start'}</div>
                      <div>{zh ? '2. 观看培训视频（约30分钟）' : '2. Watch training videos (~30 min)'}</div>
                      <div>{zh ? '3. 完成在线考试（80分通过）' : '3. Pass online exam (80%)'}</div>
                      <div>{zh ? '4. 获得证书后即可使用切片素材' : '4. Use clips after certification'}</div>
                    </div>
                    <Button
                      onClick={onGoToTraining}
                      className="mt-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90 text-white w-full"
                    >
                      <GraduationCap className="w-4 h-4 mr-2" />
                      {zh ? '前往培训认证' : 'Go to Training'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {(activeAuthTab === 'ai_avatar' || activeAuthTab === 'digital_human') && (
              <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/10 text-left">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-bold text-white text-sm mb-1">{zh ? '授权已生效' : 'Authorization Activated'}</div>
                    <div className="text-xs text-gray-400">
                      {zh ? `已为您的 ${selectedAccountCount} 个账号开通授权，现在可以在创作工坊中使用AI功能生成内容了` : `Authorization activated for ${selectedAccountCount} accounts. You can now use AI features in the creation studio`}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-center pt-4">
              <Button onClick={() => handleViewModeChange('authorized')} variant="outline" className="border-white/20 text-gray-400">
                {zh ? '查看已授权' : 'View Authorized'}
              </Button>
              <Button onClick={resetFlow} className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:opacity-90 text-white">
                {zh ? '继续申请授权' : 'Apply More'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
