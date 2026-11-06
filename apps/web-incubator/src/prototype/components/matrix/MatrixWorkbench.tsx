/**
 * MatrixWorkbench — 矩阵打歌宣发工作台
 * 第3大角色专属工作台：多平台矩阵发布 · 打歌热度追踪 · 账号矩阵健康 · 宣发日历
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Radio, TrendingUp, BarChart3, Zap, Play, Target, CheckCircle2,
  Clock, AlertTriangle, Star, Globe, Eye, Heart, MessageSquare,
  ChevronRight, RefreshCw, Plus, Settings, ArrowUpRight,
  Flame, Users, Layers, Calendar, Music, Crown
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from 'recharts';
import type { Lang } from '../../translations';

// ─── Types ───────────────────────────────────────────────────────
type CampaignStatus = 'active' | 'scheduled' | 'ended' | 'draft';
type PlatformKey = 'DY' | 'KS' | 'XHS' | 'VCH' | 'BL' | 'WB';

interface Campaign {
  id: string; name: string; artist: string; song: string;
  status: CampaignStatus; startAt: string; endAt: string;
  targetViews: number; currentViews: number;
  platforms: PlatformKey[]; accounts: number;
  hotScore: number; peakRank: number;
  budget: number; budgetUsed: number;
}

interface PlatformStat {
  platform: PlatformKey; views: number; likes: number;
  comments: number; shares: number; accounts: number;
  trend: number; color: string; isHealthy: boolean;
}

interface AccountNode {
  id: string; name: string; platform: PlatformKey;
  fans: number; lastPost: string; status: 'active' | 'idle' | 'banned';
  postsToday: number; healthScore: number;
}

// ─── Mock Data ────────────────────────────────────────────────────
const HEAT_DATA = [
  { date: '9/1', hot: 20, dy: 35000, ks: 22000, xhs: 8000 },
  { date: '9/3', hot: 35, dy: 68000, ks: 41000, xhs: 15000 },
  { date: '9/5', hot: 62, dy: 124000, ks: 78000, xhs: 28000 },
  { date: '9/7', hot: 88, dy: 198000, ks: 120000, xhs: 45000 },
  { date: '9/9', hot: 75, dy: 165000, ks: 98000, xhs: 38000 },
  { date: '9/11', hot: 91, dy: 234000, ks: 145000, xhs: 55000 },
];

const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: 'c1', name: '宋一鸣《星河》打榜计划', artist: '宋一鸣', song: '《星河》',
    status: 'active', startAt: '2025-09-05', endAt: '2025-09-20',
    targetViews: 5000000, currentViews: 3840000,
    platforms: ['DY', 'KS', 'XHS', 'VCH'], accounts: 24,
    hotScore: 91, peakRank: 3, budget: 80000, budgetUsed: 54200,
  },
  {
    id: 'c2', name: '林音宝护肤专辑宣发', artist: '林音宝', song: '《心跳》',
    status: 'active', startAt: '2025-09-08', endAt: '2025-09-30',
    targetViews: 2000000, currentViews: 890000,
    platforms: ['DY', 'XHS'], accounts: 12,
    hotScore: 64, peakRank: 18, budget: 30000, budgetUsed: 12600,
  },
  {
    id: 'c3', name: '顾然《逐光》战略发行', artist: '顾然', song: '《逐光》',
    status: 'scheduled', startAt: '2025-09-15', endAt: '2025-10-05',
    targetViews: 10000000, currentViews: 0,
    platforms: ['DY', 'KS', 'XHS', 'VCH', 'BL', 'WB'], accounts: 42,
    hotScore: 0, peakRank: 0, budget: 200000, budgetUsed: 0,
  },
];

const PLATFORM_STATS: PlatformStat[] = [
  { platform: 'DY',  views: 2340000, likes: 184000, comments: 42000, shares: 28000, accounts: 18, trend: 15.2, color: '#ff2d55', isHealthy: true },
  { platform: 'KS',  views: 1450000, likes: 98000,  comments: 21000, shares: 14000, accounts: 12, trend: 8.6,  color: '#ff6600', isHealthy: true },
  { platform: 'XHS', views: 550000,  likes: 62000,  comments: 18000, shares: 9200,  accounts: 8,  trend: 22.4, color: '#ff2442', isHealthy: true },
  { platform: 'VCH', views: 320000,  likes: 28000,  comments: 6400,  shares: 4100,  accounts: 6,  trend: -3.1, color: '#07c160', isHealthy: false },
  { platform: 'BL',  views: 180000,  likes: 22000,  comments: 8800,  shares: 2200,  accounts: 4,  trend: 5.8,  color: '#00aeec', isHealthy: true },
  { platform: 'WB',  views: 95000,   likes: 14000,  comments: 4200,  shares: 6800,  accounts: 5,  trend: -1.4, color: '#e6162d', isHealthy: false },
];

const MOCK_ACCOUNTS: AccountNode[] = [
  { id: 'a1', name: '@星河打歌主力号',  platform: 'DY',  fans: 1280000, lastPost: '2小时前', status: 'active', postsToday: 3, healthScore: 96 },
  { id: 'a2', name: '@星河快手矩阵01', platform: 'KS',  fans: 680000,  lastPost: '4小时前', status: 'active', postsToday: 2, healthScore: 88 },
  { id: 'a3', name: '@宋一鸣粉丝站XHS', platform: 'XHS', fans: 420000,  lastPost: '1小时前', status: 'active', postsToday: 4, healthScore: 92 },
  { id: 'a4', name: '@视频号星河推荐',  platform: 'VCH', fans: 180000,  lastPost: '12小时前', status: 'idle',  postsToday: 0, healthScore: 62 },
  { id: 'a5', name: '@B站星河应援',    platform: 'BL',  fans: 95000,   lastPost: '3小时前', status: 'active', postsToday: 1, healthScore: 81 },
  { id: 'a6', name: '@微博超话维护号',  platform: 'WB',  fans: 220000,  lastPost: '8小时前', status: 'idle',  postsToday: 1, healthScore: 55 },
];

const SCHEDULE_ITEMS = [
  { time: '10:00', platform: 'DY',  content: '《星河》MV预告-完整版', account: '@星河打歌主力号', status: 'done' as const },
  { time: '12:30', platform: 'KS',  content: '宋一鸣录音室花絮', account: '@星河快手矩阵01', status: 'done' as const },
  { time: '15:00', platform: 'XHS', content: '星河创作故事·手稿揭秘', account: '@宋一鸣粉丝站XHS', status: 'pending' as const },
  { time: '18:00', platform: 'DY',  content: '星河挑战赛发起贴', account: '@星河打歌主力号', status: 'pending' as const },
  { time: '20:00', platform: 'VCH', content: '《星河》视频号首推', account: '@视频号星河推荐', status: 'pending' as const },
  { time: '21:30', platform: 'WB',  content: '超话日签·互动话题', account: '@微博超话维护号', status: 'pending' as const },
];

const PLATFORM_COLOR: Record<PlatformKey, string> = {
  DY: '#ff2d55', KS: '#ff6600', XHS: '#ff2442',
  VCH: '#07c160', BL: '#00aeec', WB: '#e6162d',
};

const STATUS_CFG: Record<CampaignStatus, { zh: string; en: string; color: string; bg: string; border: string }> = {
  active:    { zh: '打榜中', en: 'Active',    color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25' },
  scheduled: { zh: '待启动', en: 'Scheduled', color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/25' },
  ended:     { zh: '已结束', en: 'Ended',     color: 'text-gray-500',    bg: 'bg-gray-500/10',    border: 'border-gray-500/20' },
  draft:     { zh: '草稿',   en: 'Draft',     color: 'text-gray-600',    bg: 'bg-gray-500/5',     border: 'border-gray-500/15' },
};

interface Props { lang: Lang; onBack: () => void; }

export const MatrixWorkbench = ({ lang, onBack }: Props) => {
  const zh = lang === 'zh';
  const [tab, setTab] = useState<'overview' | 'campaigns' | 'accounts' | 'schedule'>('overview');
  const [activeCampaign, setActiveCampaign] = useState<Campaign>(MOCK_CAMPAIGNS[0]);
  const [metricKey, setMetricKey] = useState<'dy' | 'ks' | 'xhs'>('dy');

  const activeC = MOCK_CAMPAIGNS.filter(c => c.status === 'active');
  const totalViews = PLATFORM_STATS.reduce((s, p) => s + p.views, 0);
  const totalAccounts = PLATFORM_STATS.reduce((s, p) => s + p.accounts, 0);

  return (
    <div className="min-h-screen bg-black text-white" style={{ fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-black/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition">
            <ChevronRight className="w-3.5 h-3.5 rotate-180" />
            {zh ? '返回运营端' : 'Back'}
          </button>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center">
              <Radio className="w-4 h-4 text-pink-400" />
            </div>
            <div>
              <div className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                {zh ? '矩阵打歌宣发台' : 'Matrix Promotion Workbench'}
              </div>
              <div className="text-[9px] text-gray-500">{zh ? '多平台矩阵 · 热度追踪 · 宣发日历' : 'Multi-platform · Heat tracking · Schedule'}</div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400 font-bold">{activeC.length}{zh ? '个宣发进行中' : ' campaigns live'}</span>
            </div>
            <button className="p-2 rounded-lg border border-white/8 text-gray-500 hover:text-white hover:border-white/20 transition">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-500/10 border border-pink-500/25 text-pink-400 text-xs font-bold hover:bg-pink-500/20 transition">
              <Plus className="w-3.5 h-3.5" />{zh ? '新建宣发' : 'New Campaign'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 flex gap-1 pb-0">
          {([
            ['overview',   zh ? '热度概览' : 'Heat Overview', Radio],
            ['campaigns',  zh ? '宣发计划' : 'Campaigns',    Target],
            ['accounts',   zh ? '账号矩阵' : 'Account Matrix', Layers],
            ['schedule',   zh ? '今日排期' : 'Today Schedule', Calendar],
          ] as const).map(([t, label, Ic]) => {
            const TabIcon = Ic;
            return (
              <button key={t} onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
                  tab === t ? 'border-pink-400 text-pink-400' : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}>
                <TabIcon className="w-3.5 h-3.5" />{label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-5 space-y-5">

        {/* ══════════ TAB: 热度概览 ══════════ */}
        {tab === 'overview' && (
          <>
            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: zh ? '打榜总播放' : 'Total Views',    value: `${(totalViews / 10000).toFixed(0)}万`, color: '#ec4899', icon: Eye },
                { label: zh ? '矩阵账号数' : 'Matrix Accounts', value: totalAccounts,                          color: '#06b6d4', icon: Users },
                { label: zh ? '热度峰值'  : 'Peak Hot Score',  value: `${activeCampaign.hotScore}`,             color: '#f59e0b', icon: Flame },
                { label: zh ? '最高排名'  : 'Peak Rank',       value: `#${activeCampaign.peakRank}`,           color: '#a855f7', icon: Crown },
              ].map((k, i) => {
                const KIcon = k.icon;
                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <KIcon className="w-3.5 h-3.5" style={{ color: k.color }} />
                      <span className="text-[10px] text-gray-500">{k.label}</span>
                    </div>
                    <div className="text-2xl font-black" style={{ color: k.color, fontFamily: 'var(--font-display)' }}>{k.value}</div>
                  </motion.div>
                );
              })}
            </div>

            {/* Campaign selector + Heat chart */}
            <div className="grid md:grid-cols-[260px_1fr] gap-4">
              {/* Campaign list */}
              <div className="space-y-2">
                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">{zh ? '选择宣发' : 'Select Campaign'}</div>
                {MOCK_CAMPAIGNS.map(c => {
                  const sCfg = STATUS_CFG[c.status];
                  return (
                    <button key={c.id} onClick={() => setActiveCampaign(c)}
                      className={`w-full text-left p-3 rounded-xl border transition ${activeCampaign.id === c.id ? 'bg-pink-500/8 border-pink-500/25' : 'bg-gray-900/50 border-white/5 hover:border-white/15'}`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Music className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                        <span className="text-xs font-bold text-white truncate">{c.song}</span>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ml-auto shrink-0 ${sCfg.bg} ${sCfg.color} ${sCfg.border}`}>
                          {zh ? sCfg.zh : sCfg.en}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500">{c.artist} · {c.accounts}{zh ? '个账号' : ' accounts'}</div>
                      {c.status === 'active' && (
                        <div className="mt-2">
                          <div className="flex justify-between text-[9px] text-gray-600 mb-1">
                            <span>{(c.currentViews / 10000).toFixed(0)}万</span>
                            <span>{(c.targetViews / 10000).toFixed(0)}万 {zh ? '目标' : 'target'}</span>
                          </div>
                          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-orange-500"
                              style={{ width: `${Math.min((c.currentViews / c.targetViews) * 100, 100)}%` }} />
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Heat chart */}
              <div className="bg-gray-900/50 border border-white/5 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div>
                    <div className="text-sm font-bold text-white">{activeCampaign.name}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{zh ? '热度曲线 · 平台播放量' : 'Heat curve · Platform views'}</div>
                  </div>
                  <div className="flex gap-1">
                    {([['dy', 'DY', '#ff2d55'], ['ks', 'KS', '#ff6600'], ['xhs', 'XHS', '#ff2442']] as const).map(([k, label, color]) => (
                      <button key={k} onClick={() => setMetricKey(k)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition ${metricKey === k ? 'bg-white/10 text-white border-white/20' : 'text-gray-600 border-white/5 hover:border-white/15'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={HEAT_DATA}>
                      <defs>
                        <linearGradient id="gradHeat" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradPlat" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={metricKey === 'dy' ? '#ff2d55' : metricKey === 'ks' ? '#ff6600' : '#ff2442'} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={metricKey === 'dy' ? '#ff2d55' : metricKey === 'ks' ? '#ff6600' : '#ff2442'} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} width={50} />
                      <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }} />
                      <Area type="monotone" dataKey="hot" name={zh ? '热度指数' : 'Hot Score'} stroke="#ec4899" fill="url(#gradHeat)" strokeWidth={2} dot={false} />
                      <Area type="monotone" dataKey={metricKey} name={`${metricKey.toUpperCase()} ${zh ? '播放量' : 'Views'}`}
                        stroke={metricKey === 'dy' ? '#ff2d55' : metricKey === 'ks' ? '#ff6600' : '#ff2442'}
                        fill="url(#gradPlat)" strokeWidth={1.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Platform overview row */}
                <div className="grid grid-cols-3 gap-2 mt-4">
                  {PLATFORM_STATS.slice(0, 3).map(p => (
                    <div key={p.platform} className="bg-black/30 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black" style={{ color: p.color }}>{p.platform}</span>
                        <span className={`text-[9px] flex items-center gap-0.5 ${p.trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {p.trend >= 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : ''}{p.trend}%
                        </span>
                      </div>
                      <div className="text-sm font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>{(p.views / 10000).toFixed(0)}万</div>
                      <div className="text-[9px] text-gray-600">{p.likes / 1000}K{zh ? '赞' : ' likes'} · {p.comments / 1000}K{zh ? '评' : ' cmt'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Platform Grid full */}
            <div className="bg-gray-900/50 border border-white/5 rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-4">{zh ? '全平台矩阵表现' : 'All-Platform Matrix Performance'}</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {PLATFORM_STATS.map((p, i) => (
                  <motion.div key={p.platform} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                    className={`rounded-xl p-3 border transition ${p.isHealthy ? 'bg-black/30 border-white/5' : 'bg-red-500/3 border-red-500/10'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black" style={{ color: p.color }}>{p.platform}</span>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${p.isHealthy ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
                        {p.isHealthy
                          ? <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          : <AlertTriangle className="w-3 h-3 text-red-400" />}
                      </div>
                    </div>
                    <div className="text-lg font-black mb-1" style={{ color: p.color, fontFamily: 'var(--font-display)' }}>{(p.views / 10000).toFixed(0)}万</div>
                    <div className="space-y-1 text-[9px] text-gray-600">
                      <div className="flex justify-between"><span>{zh ? '赞' : 'Likes'}</span><span>{(p.likes / 1000).toFixed(0)}K</span></div>
                      <div className="flex justify-between"><span>{zh ? '评' : 'Comments'}</span><span>{(p.comments / 1000).toFixed(0)}K</span></div>
                      <div className="flex justify-between"><span>{zh ? '账号' : 'Accs'}</span><span>{p.accounts}</span></div>
                    </div>
                    <div className={`mt-2 text-[9px] flex items-center gap-0.5 ${p.trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {p.trend >= 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : ''}
                      {Math.abs(p.trend)}% {zh ? '趋势' : 'trend'}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ══════════ TAB: 宣发计划 ══════════ */}
        {tab === 'campaigns' && (
          <div className="space-y-4">
            {MOCK_CAMPAIGNS.map((c, i) => {
              const sCfg = STATUS_CFG[c.status];
              const viewPct = c.targetViews > 0 ? Math.min((c.currentViews / c.targetViews) * 100, 100) : 0;
              const budgetPct = c.budget > 0 ? Math.min((c.budgetUsed / c.budget) * 100, 100) : 0;
              return (
                <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                  className={`bg-gray-900/50 border rounded-xl p-5 transition ${c.status === 'active' ? 'border-pink-500/20' : 'border-white/5'}`}>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Music className="w-4 h-4 text-pink-400" />
                        <span className="text-sm font-bold text-white">{c.name}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${sCfg.bg} ${sCfg.color} ${sCfg.border}`}>
                          {zh ? sCfg.zh : sCfg.en}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500">{c.artist} · {c.startAt} → {c.endAt}</div>
                    </div>
                    {c.status === 'active' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-center">
                          <div className="text-2xl font-black text-amber-400" style={{ fontFamily: 'var(--font-display)' }}>{c.hotScore}</div>
                          <div className="text-[9px] text-gray-600">{zh ? '热度' : 'Hot'}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-black text-pink-400" style={{ fontFamily: 'var(--font-display)' }}>#{c.peakRank}</div>
                          <div className="text-[9px] text-gray-600">{zh ? '排名' : 'Rank'}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Platforms */}
                    <div>
                      <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">{zh ? '覆盖平台' : 'Platforms'}</div>
                      <div className="flex gap-1.5 flex-wrap">
                        {c.platforms.map(p => (
                          <span key={p} className="text-[10px] font-bold px-2 py-1 rounded-lg border"
                            style={{ color: PLATFORM_COLOR[p], borderColor: `${PLATFORM_COLOR[p]}30`, background: `${PLATFORM_COLOR[p]}10` }}>
                            {p}
                          </span>
                        ))}
                        <span className="text-[10px] text-gray-500 flex items-center gap-1 ml-1">
                          <Users className="w-3 h-3" />{c.accounts}{zh ? '个账号' : ' accs'}
                        </span>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-gray-500">{zh ? '播放目标' : 'View Target'}</span>
                          <span className="text-white">{(c.currentViews / 10000).toFixed(0)}万 / {(c.targetViews / 10000).toFixed(0)}万</span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                          <motion.div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-orange-500"
                            initial={{ width: 0 }} animate={{ width: `${viewPct}%` }} transition={{ duration: 0.8 }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-gray-500">{zh ? '预算消耗' : 'Budget'}</span>
                          <span className="text-white">¥{c.budgetUsed.toLocaleString()} / ¥{c.budget.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <motion.div className="h-full rounded-full bg-amber-500"
                            initial={{ width: 0 }} animate={{ width: `${budgetPct}%` }} transition={{ duration: 0.8, delay: 0.1 }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ══════════ TAB: 账号矩阵 ══════════ */}
        {tab === 'accounts' && (
          <div className="space-y-3">
            {/* Health summary */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: zh ? '健康账号' : 'Healthy', value: MOCK_ACCOUNTS.filter(a => a.status === 'active').length, color: '#22c55e' },
                { label: zh ? '待激活' : 'Idle', value: MOCK_ACCOUNTS.filter(a => a.status === 'idle').length, color: '#f59e0b' },
                { label: zh ? '被封禁' : 'Banned', value: MOCK_ACCOUNTS.filter(a => a.status === 'banned').length, color: '#ef4444' },
              ].map((s, i) => (
                <div key={i} className="bg-gray-900/50 border border-white/5 rounded-xl p-4 text-center">
                  <div className="text-2xl font-black mb-1" style={{ color: s.color, fontFamily: 'var(--font-display)' }}>{s.value}</div>
                  <div className="text-[10px] text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>

            {MOCK_ACCOUNTS.map((acc, i) => {
              const statusColor = acc.status === 'active' ? 'text-emerald-400' : acc.status === 'idle' ? 'text-amber-400' : 'text-red-400';
              const statusBg = acc.status === 'active' ? 'bg-emerald-400' : acc.status === 'idle' ? 'bg-amber-400' : 'bg-red-400';
              return (
                <motion.div key={acc.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition hover:border-white/15 ${acc.status === 'banned' ? 'bg-red-500/3 border-red-500/15 opacity-70' : 'bg-gray-900/50 border-white/5'}`}>
                  {/* Platform indicator */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                    style={{ background: `${PLATFORM_COLOR[acc.platform]}10`, borderColor: `${PLATFORM_COLOR[acc.platform]}25` }}>
                    <span className="text-[10px] font-black" style={{ color: PLATFORM_COLOR[acc.platform] }}>{acc.platform}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-white">{acc.name}</span>
                      <div className={`w-1.5 h-1.5 rounded-full ${statusBg}`} />
                      <span className={`text-[9px] font-bold ${statusColor}`}>
                        {acc.status === 'active' ? (zh ? '活跃' : 'Active') : acc.status === 'idle' ? (zh ? '空置' : 'Idle') : (zh ? '封禁' : 'Banned')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-500">
                      <span>{(acc.fans / 10000).toFixed(0)}万{zh ? '粉丝' : ' fans'}</span>
                      <span>{zh ? '今日发布' : 'Today'}: {acc.postsToday}</span>
                      <span>{zh ? '最近' : 'Last'}: {acc.lastPost}</span>
                    </div>
                  </div>

                  {/* Health bar */}
                  <div className="w-20 shrink-0">
                    <div className="text-[9px] text-gray-600 mb-1 text-center">{zh ? '健康度' : 'Health'}</div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${acc.healthScore}%`, background: acc.healthScore >= 80 ? '#22c55e' : acc.healthScore >= 50 ? '#f59e0b' : '#ef4444' }} />
                    </div>
                    <div className="text-[9px] font-bold text-center mt-0.5"
                      style={{ color: acc.healthScore >= 80 ? '#22c55e' : acc.healthScore >= 50 ? '#f59e0b' : '#ef4444' }}>{acc.healthScore}</div>
                  </div>

                  <button className="px-3 py-1.5 rounded-lg border border-white/8 text-[10px] text-gray-400 hover:border-pink-500/25 hover:text-pink-400 transition">
                    {zh ? '管理' : 'Manage'}
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ══════════ TAB: 今日排期 ══════════ */}
        {tab === 'schedule' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">{zh ? '今日宣发排期 — 2025/09/11' : "Today's Schedule — 2025/09/11"}</div>
              <div className="flex items-center gap-2 text-[10px] text-gray-600">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                {SCHEDULE_ITEMS.filter(s => s.status === 'done').length}{zh ? '已完成' : ' done'} ·
                <Clock className="w-3 h-3 text-blue-400" />
                {SCHEDULE_ITEMS.filter(s => s.status === 'pending').length}{zh ? '待发布' : ' pending'}
              </div>
            </div>

            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[38px] top-4 bottom-4 w-px bg-white/5" />

              <div className="space-y-2">
                {SCHEDULE_ITEMS.map((item, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                    className="flex items-center gap-3">
                    {/* Time */}
                    <div className="w-14 text-right text-[10px] text-gray-600 shrink-0">{item.time}</div>

                    {/* Dot */}
                    <div className={`w-3 h-3 rounded-full shrink-0 border-2 border-black z-10 ${
                      item.status === 'done' ? 'bg-emerald-400' : 'bg-blue-400 animate-pulse'
                    }`} />

                    {/* Card */}
                    <div className={`flex-1 flex items-center gap-3 p-3 rounded-xl border transition ${
                      item.status === 'done' ? 'bg-emerald-500/3 border-emerald-500/10 opacity-70' : 'bg-gray-900/50 border-white/5 hover:border-white/15'
                    }`}>
                      <span className="text-[10px] font-black px-2 py-1 rounded-lg border shrink-0"
                        style={{ color: PLATFORM_COLOR[item.platform as PlatformKey], borderColor: `${PLATFORM_COLOR[item.platform as PlatformKey]}25`, background: `${PLATFORM_COLOR[item.platform as PlatformKey]}10` }}>
                        {item.platform}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-white truncate">{item.content}</div>
                        <div className="text-[9px] text-gray-500">{item.account}</div>
                      </div>
                      {item.status === 'done'
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        : <button className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-pink-500/10 border border-pink-500/25 text-[9px] font-bold text-pink-400 hover:bg-pink-500/20 transition">
                            <Play className="w-2.5 h-2.5" />{zh ? '发布' : 'Publish'}
                          </button>}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
