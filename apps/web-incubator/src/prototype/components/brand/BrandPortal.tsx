/**
 * 品牌端门户 v2.0 — P4深化
 * 数据总览 · 艺人匹配 · 发现投流 · 价格议价 · 样品管理 · ROI报告
 * 全局规范：无emoji · 成员表达式JSX已全部替换
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building2, TrendingUp, ShoppingBag, Zap, Eye, Star,
  Play, BarChart3, Coins, Users, ChevronRight, Plus,
  CheckCircle2, Clock, Search, Filter, MessageSquare,
  Package, Truck, ArrowUpRight, Target, Crown, Handshake,
  Video, BadgeCheck, AlertCircle, Send, X, Music,
  Sparkles, Shield, Radio, Globe, Layers, FileText, TrendingDown,
  Award, Heart, SlidersHorizontal
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import type { Lang } from '../../translations';

// ─── Types ───────────────────────────────────────────────────────
type TabKey = 'overview' | 'match' | 'discover' | 'negotiate' | 'samples' | 'roi';
type NegotiationStatus = 'open' | 'counter' | 'accepted' | 'rejected';

interface KPIItem {
  label: { zh: string; en: string };
  value: string | number;
  color: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  trend?: number;
}

interface HotVideo {
  id: string; title: string; mcnName: string; artistName: string;
  celebrity?: string; platform: string; views: string;
  gmv: string; conversion: string; boostable: boolean;
}

interface ArtistMatch {
  id: string; name: string; level: 'S' | 'A' | 'B';
  followers: string; avgViews: string; conversionRate: string;
  categories: string[]; matchScore: number;
  description: string; descriptionEn: string;
  gmvHistory: number; exclusiveMonths: number;
  available: boolean;
}

interface NegotiationThread {
  id: string; mcnName: string; proposal: string;
  status: NegotiationStatus; myBid: number;
  theirAsk: number; lastUpdated: string;
}

// ─── Mock Data ────────────────────────────────────────────────────
const GMV_TREND = [
  { date: '4/1', gmv: 8400 }, { date: '4/7', gmv: 12600 }, { date: '4/14', gmv: 28400 },
  { date: '4/21', gmv: 34200 }, { date: '4/28', gmv: 41800 }, { date: '5/7', gmv: 38600 },
];

const PLATFORM_DATA = [
  { name: '抖音', orders: 428, gmv: 82400 },
  { name: '快手', orders: 186, gmv: 34200 },
  { name: '小红书', orders: 94, gmv: 18600 },
  { name: '视频号', orders: 58, gmv: 11200 },
];

const ROI_DATA = [
  { week: 'W1', spend: 12000, revenue: 38400, roi: 3.2 },
  { week: 'W2', spend: 15000, revenue: 52500, roi: 3.5 },
  { week: 'W3', spend: 18000, revenue: 72000, roi: 4.0 },
  { week: 'W4', spend: 22000, revenue: 96800, roi: 4.4 },
];

const ARTIST_MATCHES: ArtistMatch[] = [
  {
    id: 'am1', name: '于震', level: 'S', followers: '4530万', avgViews: '86万',
    conversionRate: '4.2%', categories: ['数码', '户外', '男装'], matchScore: 96,
    description: '硬汉形象，战术/户外品类高度契合，带货转化率业内顶尖',
    descriptionEn: 'Tough image, ideal fit for tactical/outdoor goods, top conversion rate',
    gmvHistory: 2840000, exclusiveMonths: 18, available: true,
  },
  {
    id: 'am2', name: '林音宝', level: 'A', followers: '920万', avgViews: '28万',
    conversionRate: '3.6%', categories: ['护肤', '美妆', '女装'], matchScore: 72,
    description: '温柔气质，护肤/女性消费品调性匹配，粉丝粘性高',
    descriptionEn: 'Gentle image, well-matched for skincare/feminine goods, high fan loyalty',
    gmvHistory: 480000, exclusiveMonths: 6, available: true,
  },
  {
    id: 'am3', name: '张艺星', level: 'A', followers: '1280万', avgViews: '42万',
    conversionRate: '2.8%', categories: ['音乐', '3C', '时尚'], matchScore: 58,
    description: '音乐人背景，3C和潮流品牌具有协同效应，粉丝年龄18-25',
    descriptionEn: 'Musician background, synergy with 3C and trendy brands, fans aged 18-25',
    gmvHistory: 620000, exclusiveMonths: 12, available: false,
  },
];

const MOCK_VIDEOS: HotVideo[] = [
  { id: 'v1', title: '于震亮剑切片·战术刀具测评', mcnName: 'AI Star MCN', artistName: 'Neon V', celebrity: '于震', platform: 'DY', views: '128万', gmv: '¥38,400', conversion: '4.2%', boostable: true },
  { id: 'v2', title: '肖战同款腕表·带货短视频',  mcnName: 'HypeStar Studio', artistName: 'Luna Soft', celebrity: '肖战', platform: 'KS', views: '56万', gmv: '¥22,800', conversion: '3.8%', boostable: true },
  { id: 'v3', title: 'AI艺人孵化平台介绍·合作款', mcnName: 'AI Star MCN', artistName: 'Project Zero', platform: 'XHS', views: '34万', gmv: '¥11,200', conversion: '3.1%', boostable: false },
];

const MOCK_THREADS: NegotiationThread[] = [
  { id: 'n1', mcnName: 'AI Star MCN', proposal: '于震切片长期合作（12期视频）', status: 'counter', myBid: 80000, theirAsk: 120000, lastUpdated: '2026-05-06' },
  { id: 'n2', mcnName: 'HypeStar Studio', proposal: '肖战同款快手带货月包', status: 'accepted', myBid: 45000, theirAsk: 45000, lastUpdated: '2026-05-04' },
  { id: 'n3', mcnName: 'TopCreator MCN', proposal: 'AI艺人矩阵广告植入', status: 'open', myBid: 30000, theirAsk: 60000, lastUpdated: '2026-05-07' },
];

const SAMPLE_LIST = [
  { product: '战术折叠刀·限定版', to: '@neon_v_official', mcn: 'AI Star MCN', status: 'delivered', qty: 3, value: '¥1,680', date: '2026-04-28', track: 'SF1234567890' },
  { product: '经典战术套装·旗舰版', to: '@topstar_douyin', mcn: 'TopCreator MCN', status: 'shipping', qty: 2, value: '¥3,200', date: '2026-05-06', track: 'YT9876543210' },
  { product: '户外多功能刀·合作款', to: '@luna_soft_ks', mcn: 'HypeStar Studio', status: 'requested', qty: 5, value: '¥2,100', date: '2026-05-07', track: null },
];

const NEGOTIATION_STATUS_CFG: Record<NegotiationStatus, { zh: string; en: string; color: string; bg: string }> = {
  open:     { zh: '等待回复', en: 'Awaiting Reply', color: 'text-blue-400',  bg: 'bg-blue-500/10 border-blue-500/25' },
  counter:  { zh: '对方报价', en: 'Counter Offer',  color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/25' },
  accepted: { zh: '已达成',   en: 'Accepted',       color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/25' },
  rejected: { zh: '已拒绝',   en: 'Rejected',       color: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/25' },
};

const PLATFORM_COLOR: Record<string, string> = {
  DY: '#fe2c55', KS: '#ff6600', XHS: '#ff2442', VCH: '#07c160',
};

const LEVEL_CFG: Record<'S' | 'A' | 'B', { color: string; bg: string; border: string }> = {
  S: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.35)' },
  A: { color: '#06b6d4', bg: 'rgba(6,182,212,0.15)',  border: 'rgba(6,182,212,0.35)' },
  B: { color: '#6b7280', bg: 'rgba(107,114,128,0.15)', border: 'rgba(107,114,128,0.3)' },
};

interface Props { lang: Lang; onBack: () => void; }

export const BrandPortal = ({ lang, onBack }: Props) => {
  const zh = lang === 'zh';
  const [tab, setTab] = useState<TabKey>('overview');
  const [boostedIds, setBoostedIds] = useState<Set<string>>(new Set(['v1']));
  const [negotiateOpen, setNegotiateOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [matchFilter, setMatchFilter] = useState<string>('all');

  const toggleBoost = (id: string) => {
    setBoostedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const KPIS: KPIItem[] = [
    { label: { zh: '活跃带货视频', en: 'Active Videos' }, value: 12, color: '#06b6d4', icon: Video, trend: 3 },
    { label: { zh: '本月订单数', en: 'Monthly Orders' }, value: 766, color: '#22c55e', icon: ShoppingBag, trend: 12 },
    { label: { zh: '本月GMV', en: 'Monthly GMV' }, value: '¥38.6万', color: '#f59e0b', icon: TrendingUp, trend: 8 },
    { label: { zh: '投流中视频', en: 'Boosted Videos' }, value: boostedIds.size, color: '#a855f7', icon: Zap, trend: 0 },
    { label: { zh: '签约艺人数', en: 'Artists' }, value: 2, color: '#ec4899', icon: Star, trend: 1 },
    { label: { zh: '综合ROI', en: 'ROI' }, value: '4.1×', color: '#22c55e', icon: BarChart3, trend: 5 },
  ];

  const TABS: { id: TabKey; zh: string; en: string; icon: React.ComponentType<any> }[] = [
    { id: 'overview',  zh: '数据总览', en: 'Overview', icon: BarChart3 },
    { id: 'match',     zh: 'AI艺人匹配', en: 'Artist Match', icon: Sparkles },
    { id: 'discover',  zh: '发现投流', en: 'Discover', icon: Zap },
    { id: 'negotiate', zh: '价格议价', en: 'Negotiate', icon: Handshake },
    { id: 'samples',   zh: '样品管理', en: 'Samples', icon: Package },
    { id: 'roi',       zh: 'ROI报告', en: 'ROI Report', icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen bg-black text-white" style={{ fontFamily: 'var(--font-sans)' }}>
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2 px-3 md:px-5 py-3 md:py-4 border-b border-white/5 bg-black/80 backdrop-blur-lg sticky top-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="text-sm text-gray-500 hover:text-white transition whitespace-nowrap shrink-0">
            {zh ? '← 返回' : '← Back'}<span className="hidden md:inline">{zh ? '运营端' : ''}</span>
          </button>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">{zh ? '品牌端门户' : 'Brand Portal'}</div>
              <div className="text-[9px] text-amber-400 hidden sm:block">{zh ? '某战术刀具品牌 · 金牌合作伙伴' : 'Tactical Blade Co. · Gold Partner'}</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:block text-xs text-green-400 border border-green-500/30 rounded-full px-3 py-1">
            {zh ? '本月GMV ¥38.6万' : 'Monthly GMV ¥386K'}
          </div>
          <button onClick={() => setNegotiateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white whitespace-nowrap shrink-0"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
            <Handshake className="w-3.5 h-3.5" />{zh ? '发起议价' : 'Negotiate'}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-5 space-y-5">
        {/* KPIs */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {KPIS.map((k, i) => {
            const KIcon = k.icon;
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <KIcon className="w-3.5 h-3.5" style={{ color: k.color }} />
                  <span className="text-[9px] text-gray-500 leading-tight">{zh ? k.label.zh : k.label.en}</span>
                </div>
                <div className="text-xl font-black" style={{ color: k.color, fontFamily: 'var(--font-display)' }}>{k.value}</div>
                {k.trend !== undefined && k.trend > 0 && (
                  <div className="text-[9px] text-emerald-400 mt-1 flex items-center gap-0.5">
                    <TrendingUp className="w-2.5 h-2.5" />+{k.trend}%
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-white/5 overflow-x-auto">
          {TABS.map(t => {
            const TIcon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition ${tab === t.id ? 'border-amber-400 text-amber-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                <TIcon className="w-3.5 h-3.5" />{zh ? t.zh : t.en}
              </button>
            );
          })}
        </div>

        {/* ─── Overview ─── */}
        {tab === 'overview' && (
          <div className="grid md:grid-cols-2 gap-5">
            <div className="bg-gray-900/50 border border-white/5 rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-4">{zh ? 'GMV趋势' : 'GMV Trend'}</h3>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={GMV_TREND}>
                    <defs>
                      <linearGradient id="brandGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} width={45} />
                    <Tooltip contentStyle={{ background: '#030712', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }} />
                    <Area type="monotone" dataKey="gmv" stroke="#f59e0b" fill="url(#brandGrad)" strokeWidth={2} dot={false} name="GMV" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-gray-900/50 border border-white/5 rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-4">{zh ? '平台销售分布' : 'Platform Sales'}</h3>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={PLATFORM_DATA}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip contentStyle={{ background: '#030712', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }} />
                    <Bar dataKey="gmv" fill="#f59e0b" radius={[4, 4, 0, 0]} name="GMV" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* Top performers */}
            <div className="md:col-span-2 bg-gray-900/50 border border-white/5 rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-3">{zh ? '最佳表现内容' : 'Top Performing Content'}</h3>
              <div className="grid md:grid-cols-3 gap-3">
                {[
                  { rank: 1, title: '战术刀具618首发测评', views: '128万', gmv: '¥38,400', roi: '4.2×', platform: 'DY' },
                  { rank: 2, title: '户外装备实测挑战', views: '68万', gmv: '¥22,100', roi: '3.8×', platform: 'KS' },
                  { rank: 3, title: '品牌故事·传承篇', views: '45万', gmv: '¥14,800', roi: '3.1×', platform: 'XHS' },
                ].map(item => (
                  <div key={item.rank} className="flex items-center gap-3 p-3 bg-black/30 rounded-xl border border-white/5">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                      style={{ background: item.rank === 1 ? '#f59e0b' : item.rank === 2 ? '#9ca3af' : '#cd7f32', color: '#000' }}>
                      {item.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-semibold text-white truncate">{item.title}</div>
                      <div className="flex items-center gap-2 text-[9px] text-gray-500 mt-0.5">
                        <span style={{ color: PLATFORM_COLOR[item.platform] }}>{item.platform}</span>
                        <span>{item.views}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] font-bold text-emerald-400">{item.gmv}</div>
                      <div className="text-[9px] text-amber-400">{item.roi}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── AI Artist Match ─── */}
        {tab === 'match' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-sm font-bold text-white">{zh ? 'AI艺人智能匹配' : 'AI Artist Matching'}</h2>
                <p className="text-[10px] text-gray-500 mt-0.5">{zh ? '基于品牌调性、受众重叠度和历史GMV进行智能推荐' : 'Recommendations based on brand fit, audience overlap, and GMV history'}</p>
              </div>
              <div className="flex gap-2">
                {['all', '数码', '户外', '护肤'].map(cat => (
                  <button key={cat} onClick={() => setMatchFilter(cat)}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border transition ${matchFilter === cat ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' : 'border-white/8 text-gray-500 hover:border-white/20'}`}>
                    {cat === 'all' ? (zh ? '全部' : 'All') : cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {ARTIST_MATCHES.map((artist, i) => {
                const lCfg = LEVEL_CFG[artist.level];
                const isSelected = selectedMatch === artist.id;
                return (
                  <motion.div key={artist.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                    className={`bg-gray-900/50 border rounded-2xl overflow-hidden transition cursor-pointer ${isSelected ? 'border-amber-500/40' : 'border-white/5 hover:border-white/15'} ${!artist.available ? 'opacity-60' : ''}`}
                    onClick={() => setSelectedMatch(isSelected ? null : artist.id)}>
                    <div className="p-5">
                      {/* Artist header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: lCfg.bg, border: `1px solid ${lCfg.border}` }}>
                            <Star className="w-5 h-5" style={{ color: lCfg.color }} />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white">{artist.name}</div>
                            <div className="text-[9px] font-black px-1.5 py-0.5 rounded inline-block" style={{ color: lCfg.color, background: lCfg.bg }}>{artist.level}{zh ? '级艺人' : '-Class'}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-black" style={{ color: artist.matchScore >= 90 ? '#22c55e' : artist.matchScore >= 70 ? '#f59e0b' : '#6b7280', fontFamily: 'var(--font-display)' }}>{artist.matchScore}</div>
                          <div className="text-[8px] text-gray-600">{zh ? '匹配度' : 'Match'}</div>
                        </div>
                      </div>

                      {/* Match score bar */}
                      <div className="mb-3">
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${artist.matchScore}%`, background: artist.matchScore >= 90 ? '#22c55e' : artist.matchScore >= 70 ? '#f59e0b' : '#6b7280' }} />
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {[
                          { label: zh ? '粉丝' : 'Fans', value: artist.followers, color: '#06b6d4' },
                          { label: zh ? '均播放' : 'Avg Views', value: artist.avgViews, color: '#a855f7' },
                          { label: zh ? '转化率' : 'Conv.', value: artist.conversionRate, color: '#22c55e' },
                        ].map((stat, si) => (
                          <div key={si} className="text-center p-1.5 bg-black/20 rounded-lg">
                            <div className="text-[9px] text-gray-600 mb-0.5">{stat.label}</div>
                            <div className="text-[10px] font-bold" style={{ color: stat.color }}>{stat.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Categories */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {artist.categories.map(cat => (
                          <span key={cat} className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 border border-white/8 text-gray-500">{cat}</span>
                        ))}
                      </div>

                      <p className="text-[10px] text-gray-500 leading-relaxed mb-3">{zh ? artist.description : artist.descriptionEn}</p>

                      <div className="flex gap-2">
                        {artist.available ? (
                          <button className="flex-1 h-8 rounded-xl text-[10px] font-bold text-white transition"
                            style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
                            {zh ? '发起合作' : 'Start Collab'}
                          </button>
                        ) : (
                          <div className="flex-1 h-8 rounded-xl border border-white/8 text-[10px] text-gray-600 flex items-center justify-center">
                            {zh ? '档期已满' : 'Not Available'}
                          </div>
                        )}
                        <button className="w-8 h-8 rounded-xl border border-white/8 text-gray-400 hover:text-white hover:border-white/20 transition flex items-center justify-center">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    <AnimatePresence>
                      {isSelected && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          className="border-t border-white/5 p-4 bg-black/20">
                          <div className="grid grid-cols-2 gap-3 text-[10px]">
                            <div>
                              <div className="text-gray-600 mb-0.5">{zh ? '历史合作GMV' : 'Collab GMV History'}</div>
                              <div className="text-emerald-400 font-bold">¥{(artist.gmvHistory / 10000).toFixed(0)}万</div>
                            </div>
                            <div>
                              <div className="text-gray-600 mb-0.5">{zh ? '当前独家月数' : 'Exclusive Months'}</div>
                              <div className="text-amber-400 font-bold">{artist.exclusiveMonths}{zh ? '个月' : 'mo'}</div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Discover & Boost ─── */}
        {tab === 'discover' && (
          <div className="space-y-4">
            <p className="text-[10px] text-gray-500">{zh ? '发现高潜力视频，为其定向投流（需合法授权）' : 'Find high-potential videos and fund targeted traffic boosts'}</p>
            <div className="grid md:grid-cols-3 gap-4">
              {MOCK_VIDEOS.map((video, i) => {
                const isBoosted = boostedIds.has(video.id);
                return (
                  <motion.div key={video.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                    className={`rounded-2xl overflow-hidden border transition bg-gray-900/50 ${isBoosted ? 'border-amber-500/30' : 'border-white/5'}`}>
                    {/* Thumbnail mockup */}
                    <div className="relative h-36 overflow-hidden bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
                      <div className="text-center">
                        <Video className="w-8 h-8 text-gray-700 mx-auto mb-1.5" />
                        <div className="text-[10px] text-gray-600">{video.platform}</div>
                      </div>
                      <div className="absolute top-2 left-2 flex gap-1">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: PLATFORM_COLOR[video.platform] || '#4b5563', color: '#fff' }}>{video.platform}</span>
                        {video.celebrity && (
                          <span className="text-[9px] bg-amber-500/40 text-amber-300 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <Star className="w-2 h-2" />{video.celebrity}
                          </span>
                        )}
                      </div>
                      {isBoosted && (
                        <div className="absolute top-2 right-2 bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Zap className="w-2.5 h-2.5" />{zh ? '投流中' : 'Boosting'}
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 px-3 pb-2 bg-gradient-to-t from-black to-transparent">
                        <div className="text-[10px] font-semibold text-white leading-tight">{video.title}</div>
                      </div>
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="text-[10px] text-gray-500">{video.mcnName} · {video.artistName}</div>
                      <div className="grid grid-cols-3 gap-1 text-center">
                        <div><div className="text-[9px] text-gray-600">{zh ? '播放' : 'Views'}</div><div className="text-[10px] font-bold text-cyan-400">{video.views}</div></div>
                        <div><div className="text-[9px] text-gray-600">GMV</div><div className="text-[10px] font-bold text-green-400">{video.gmv}</div></div>
                        <div><div className="text-[9px] text-gray-600">{zh ? '转化' : 'Conv.'}</div><div className="text-[10px] font-bold text-purple-400">{video.conversion}</div></div>
                      </div>
                      <button onClick={() => video.boostable && toggleBoost(video.id)} disabled={!video.boostable}
                        className={`w-full h-8 rounded-xl text-[10px] font-bold transition flex items-center justify-center gap-1.5 ${!video.boostable ? 'bg-white/5 text-gray-600 cursor-not-allowed' : isBoosted ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400' : 'text-white'}`}
                        style={video.boostable && !isBoosted ? { background: 'linear-gradient(135deg, #f59e0b, #ef4444)' } : {}}>
                        {!video.boostable ? (
                          <><Shield className="w-3 h-3" />{zh ? '无授权（不可投流）' : 'No license'}</>
                        ) : isBoosted ? (
                          <><Zap className="w-3 h-3" />{zh ? '投流中（点击停止）' : 'Boosting — click to stop'}</>
                        ) : (
                          <><Zap className="w-3 h-3" />{zh ? '为此视频定向投流' : 'Boost This Video'}</>
                        )}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Negotiate ─── */}
        {tab === 'negotiate' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{zh ? '议价谈判记录' : 'Negotiation Threads'}</span>
              <button onClick={() => setNegotiateOpen(true)}
                className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 border border-amber-500/25 rounded-lg px-3 py-1.5 transition hover:bg-amber-500/10">
                <Plus className="w-3 h-3" />{zh ? '发起议价' : 'New Negotiation'}
              </button>
            </div>
            {MOCK_THREADS.map((thread, i) => {
              const cfg = NEGOTIATION_STATUS_CFG[thread.status];
              const gap = thread.theirAsk - thread.myBid;
              return (
                <motion.div key={thread.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  className="p-4 bg-gray-900/50 border border-white/5 rounded-xl hover:border-white/10 transition">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Handshake className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-bold text-white">{thread.mcnName}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border ${cfg.bg} ${cfg.color}`}>
                          {zh ? cfg.zh : cfg.en}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500">{thread.proposal}</div>
                      <div className="flex items-center gap-4 mt-2 text-xs">
                        <div>
                          <span className="text-gray-600">{zh ? '我方报价' : 'My Bid'}</span>
                          <span className="text-green-400 font-bold ml-1">¥{thread.myBid.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">{zh ? '对方要价' : 'Their Ask'}</span>
                          <span className="text-amber-400 font-bold ml-1">¥{thread.theirAsk.toLocaleString()}</span>
                        </div>
                        {gap > 0 && (
                          <div className="text-red-400 text-[10px]">
                            {zh ? `差距 ¥${gap.toLocaleString()}` : `Gap ¥${gap.toLocaleString()}`}
                          </div>
                        )}
                      </div>
                    </div>
                    {thread.status === 'counter' && (
                      <div className="flex gap-1.5 shrink-0">
                        <button className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-500/15 text-green-400 border border-green-500/25 hover:bg-green-500/25 transition">
                          {zh ? '接受' : 'Accept'}
                        </button>
                        <button className="px-3 py-1.5 rounded-lg text-xs font-bold border border-white/8 text-gray-400 hover:text-white transition">
                          {zh ? '再议' : 'Counter'}
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ─── Samples ─── */}
        {tab === 'samples' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{zh ? '样品寄送管理' : 'Sample Management'}</span>
              <button className="flex items-center gap-1.5 text-xs text-purple-400 border border-purple-500/25 rounded-lg px-3 py-1.5 hover:bg-purple-500/10 transition">
                <Plus className="w-3 h-3" />{zh ? '寄送样品' : 'Send Sample'}
              </button>
            </div>
            {SAMPLE_LIST.map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className="flex items-center gap-3 p-4 bg-gray-900/50 border border-white/5 rounded-xl hover:border-white/10 transition">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white">{item.product}</div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500 flex-wrap">
                    <span>{item.to}</span><span>{item.mcn}</span>
                    <span>x{item.qty}</span><span className="text-amber-400">{item.value}</span>
                    {item.track && (
                      <span className="text-cyan-400 flex items-center gap-0.5">
                        <Truck className="w-2.5 h-2.5" />{item.track}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-[10px] font-bold ${item.status === 'delivered' ? 'text-cyan-400' : item.status === 'shipping' ? 'text-amber-400' : 'text-gray-400'}`}>
                    {item.status === 'delivered' ? (zh ? '已到货' : 'Delivered') : item.status === 'shipping' ? (zh ? '配送中' : 'Shipping') : (zh ? '已申请' : 'Requested')}
                  </div>
                  <div className="text-[9px] text-gray-600 mt-0.5">{item.date}</div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* ─── ROI Report ─── */}
        {tab === 'roi' && (
          <div className="space-y-5">
            <div className="grid md:grid-cols-3 gap-3">
              {[
                { label: zh ? '累计投入' : 'Total Spend', value: '¥67,000', color: '#ef4444', icon: Coins },
                { label: zh ? '累计GMV' : 'Total GMV', value: '¥273,600', color: '#22c55e', icon: TrendingUp },
                { label: zh ? '综合ROI' : 'Overall ROI', value: '4.1×', color: '#f59e0b', icon: BarChart3 },
              ].map((k, i) => {
                const KIcon = k.icon;
                return (
                  <div key={i} className="bg-gray-900/50 border border-white/5 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <KIcon className="w-4 h-4" style={{ color: k.color }} />
                      <span className="text-[10px] text-gray-500">{k.label}</span>
                    </div>
                    <div className="text-2xl font-black" style={{ color: k.color, fontFamily: 'var(--font-display)' }}>{k.value}</div>
                  </div>
                );
              })}
            </div>
            <div className="bg-gray-900/50 border border-white/5 rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-4">{zh ? '周度ROI走势' : 'Weekly ROI Trend'}</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ROI_DATA}>
                    <defs>
                      <linearGradient id="roiGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="week" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip contentStyle={{ background: '#030712', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 11 }} />
                    <Area type="monotone" dataKey="roi" stroke="#22c55e" fill="url(#roiGrad)" strokeWidth={2} dot={{ fill: '#22c55e', r: 4 }} name="ROI" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-gray-900/50 border border-white/5 rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-4">{zh ? '分周投入产出明细' : 'Weekly Spend vs Revenue'}</h3>
              <div className="space-y-2">
                {ROI_DATA.map((row, i) => (
                  <div key={i} className="grid grid-cols-4 gap-3 p-3 bg-black/20 rounded-xl text-[10px]">
                    <span className="font-bold text-white">{row.week}</span>
                    <span className="text-red-400">-¥{row.spend.toLocaleString()}</span>
                    <span className="text-emerald-400">+¥{row.revenue.toLocaleString()}</span>
                    <span className="text-amber-400 font-bold">{row.roi}×</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Negotiate Modal */}
      <AnimatePresence>
        {negotiateOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setNegotiateOpen(false); }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-950 border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white">{zh ? '发起合作议价' : 'Start Negotiation'}</h3>
                <button onClick={() => setNegotiateOpen(false)} className="text-gray-500 hover:text-white transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <select className="w-full h-10 bg-white/[0.03] border border-white/8 rounded-xl px-3 text-sm text-gray-400 focus:outline-none">
                  <option>{zh ? '选择MCN机构' : 'Select MCN'}</option>
                  <option>AI Star MCN</option><option>HypeStar Studio</option><option>TopCreator MCN</option>
                </select>
                <input placeholder={zh ? '合作方案描述' : 'Proposal description'}
                  className="w-full h-10 bg-white/[0.03] border border-white/8 rounded-xl px-3 text-sm text-white placeholder-gray-600 focus:outline-none transition" />
                <input placeholder={zh ? '我方出价（¥）' : 'My bid (¥)'} type="number"
                  className="w-full h-10 bg-white/[0.03] border border-white/8 rounded-xl px-3 text-sm text-white placeholder-gray-600 focus:outline-none transition" />
                <textarea placeholder={zh ? '附加说明（可选）' : 'Additional notes'} rows={2}
                  className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none resize-none transition" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setNegotiateOpen(false)}
                  className="flex-1 h-10 rounded-xl border border-white/8 text-sm text-gray-400 hover:text-white transition">
                  {zh ? '取消' : 'Cancel'}
                </button>
                <button onClick={() => setNegotiateOpen(false)}
                  className="flex-1 h-10 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
                  <Send className="w-4 h-4" />{zh ? '发送议价' : 'Send Proposal'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BrandPortal;
